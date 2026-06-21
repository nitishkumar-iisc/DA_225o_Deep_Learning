import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { scoreJobFit } from "@/lib/anthropic";
import { predict, defaultWeights } from "@/lib/ml-model";
import {
  Resume,
  Job,
  MLModel,
  FeatureVector,
  JobEducationLevel,
  ResumeEducationLevel,
} from "@/types";

// Education ordinals for the job's required level (SPEC §5.2)
const JOB_EDU_ORDINAL: Record<JobEducationLevel, number> = {
  any: 0.5,
  bachelor: 0.6,
  master: 0.8,
  phd: 1.0,
};

// Education ordinals for the candidate's level
const CANDIDATE_EDU_ORDINAL: Record<ResumeEducationLevel, number> = {
  none: 0,
  bachelor: 0.6,
  master: 0.8,
  phd: 1.0,
};

function computeEducationScore(
  jobLevel: JobEducationLevel,
  candidateLevel: ResumeEducationLevel
): number {
  if (jobLevel === "any") return 0.5; // anyone qualifies for the baseline score
  const jobOrd = JOB_EDU_ORDINAL[jobLevel];
  const candidateOrd = CANDIDATE_EDU_ORDINAL[candidateLevel] ?? 0;
  // Full score if candidate meets or exceeds requirement; otherwise their ordinal
  return candidateOrd >= jobOrd ? jobOrd : candidateOrd;
}

// Jaccard similarity: |A ∩ B| / |A ∪ B|
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map((s) => s.toLowerCase().trim()));
  const setB = new Set(b.map((s) => s.toLowerCase().trim()));
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 1 : intersection / union;
}

// POST /api/score — internal endpoint; called by fan-out logic (no user auth needed)
// Body: { resumeId: string, jobId: string, appId: string }
export async function POST(request: NextRequest) {
  let body: { resumeId?: string; jobId?: string; appId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { resumeId, jobId, appId } = body;
  if (!resumeId || !jobId || !appId) {
    return NextResponse.json(
      { error: "resumeId, jobId, and appId are required" },
      { status: 400 }
    );
  }

  // Load resume and job from Firestore (Admin SDK)
  const [resumeSnap, jobSnap] = await Promise.all([
    adminDb.collection("resumes").doc(resumeId).get(),
    adminDb.collection("jobs").doc(jobId).get(),
  ]);

  if (!resumeSnap.exists) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }
  if (!jobSnap.exists) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const resume = resumeSnap.data() as Resume;
  const job = jobSnap.data() as Job;

  if (!resume.parsedData) {
    return NextResponse.json({ error: "Resume has not been parsed yet" }, { status: 422 });
  }

  const parsed = resume.parsedData;

  // Step 1: Ask Claude for keywordMatchScore and claudeRawScore (SPEC §5.2, §6.2)
  let claudeResult;
  try {
    claudeResult = await scoreJobFit(
      {
        skills: parsed.skills,
        experienceYears: parsed.experienceYears,
        educationLevel: parsed.educationLevel,
        workHistory: parsed.workHistory,
        summary: parsed.summary,
      },
      {
        title: job.title,
        description: job.description,
        requiredSkills: job.requiredSkills,
        requiredExperienceYears: job.requiredExperienceYears,
        educationLevel: job.educationLevel,
      }
    );
  } catch (err) {
    console.error("[score] Claude call failed:", err);
    return NextResponse.json({ error: "Claude scoring failed" }, { status: 502 });
  }

  // Step 2: Compute deterministic features (SPEC §5.2)
  const experienceMatchScore =
    job.requiredExperienceYears === 0
      ? 1
      : Math.min(parsed.experienceYears / job.requiredExperienceYears, 1);

  const educationScore = computeEducationScore(job.educationLevel, parsed.educationLevel);

  const skillsOverlapScore = jaccardSimilarity(job.requiredSkills, parsed.skills);

  // Step 3: Build feature vector — order is critical for ML model (SPEC §5.2)
  const featureVector: FeatureVector = {
    keywordMatchScore: claudeResult.keywordMatchScore,
    experienceMatchScore,
    educationScore,
    skillsOverlapScore,
    claudeRawScore: claudeResult.claudeRawScore,
  };

  const featuresArray = [
    featureVector.keywordMatchScore,
    featureVector.experienceMatchScore,
    featureVector.educationScore,
    featureVector.skillsOverlapScore,
    featureVector.claudeRawScore,
  ];

  // Step 4: Load ML weights or fall back to defaults (SPEC §5.3)
  let weights: number[];
  let bias: number;

  const modelSnap = await adminDb.collection("mlModels").doc(jobId).get();
  if (modelSnap.exists) {
    const model = modelSnap.data() as MLModel;
    weights = model.weights;
    bias = model.bias;
  } else {
    const defaults = defaultWeights();
    weights = defaults.weights;
    bias = defaults.bias;
  }

  // Step 5: Predict probability and convert to 0–100 score (SPEC §5.2)
  const probability = predict(featuresArray, weights, bias);
  const fitScore = Math.round(probability * 100);

  // Step 6: Write fitScore, featureVector, and Claude reasoning to applications/{appId}
  const now = new Date().toISOString();
  await adminDb
    .collection("applications")
    .doc(appId)
    .update({
      fitScore,
      featureVector,
      claudeReasoning: claudeResult.reasoning,
      updatedAt: now,
    });

  return NextResponse.json({ fitScore, featureVector, probability }, { status: 200 });
}
