import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { train } from "@/lib/ml-model";
import { Application, Job, MLModel } from "@/types";

const MIN_EXAMPLES = 5;

// POST /api/ml/train — internal endpoint; called after recruiter decision.
// Trains ONE org-level model per recruiter using ALL decisions across ALL their jobs.
// Body: { recruiterId: string }
export async function POST(request: NextRequest) {
  let body: { recruiterId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { recruiterId } = body;
  if (!recruiterId) {
    return NextResponse.json({ error: "recruiterId is required" }, { status: 400 });
  }

  // All jobs for this recruiter
  const jobsSnap = await adminDb
    .collection("jobs")
    .where("recruiterId", "==", recruiterId)
    .get();

  const jobIds = jobsSnap.docs.map((d) => (d.data() as Job).id);

  if (jobIds.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No jobs found for recruiter", sampleCount: 0 });
  }

  // Collect all decided applications across every job (Firestore `in` supports up to 30 items)
  const CHUNK = 30;
  let decidedApps: Application[] = [];
  for (let i = 0; i < jobIds.length; i += CHUNK) {
    const chunk = jobIds.slice(i, i + CHUNK);
    const snap = await adminDb
      .collection("applications")
      .where("jobId", "in", chunk)
      .where("decision", "!=", null)
      .get();
    decidedApps = decidedApps.concat(snap.docs.map((d) => d.data() as Application));
  }

  if (decidedApps.length < MIN_EXAMPLES) {
    return NextResponse.json(
      {
        skipped: true,
        reason: `Need at least ${MIN_EXAMPLES} decisions across all roles; have ${decidedApps.length}`,
        sampleCount: decidedApps.length,
      },
      { status: 200 }
    );
  }

  const trainingExamples = decidedApps.map((app) => ({
    features: [
      app.featureVector.keywordMatchScore,
      app.featureVector.experienceMatchScore,
      app.featureVector.educationScore,
      app.featureVector.skillsOverlapScore,
      app.featureVector.claudeRawScore,
    ],
    label: app.decision === "approved" ? 1 : 0,
  }));

  const { weights, bias } = train(trainingExamples);
  const approvedCount = decidedApps.filter((a) => a.decision === "approved").length;
  const positiveRate = approvedCount / decidedApps.length;

  const modelPayload: MLModel = {
    recruiterId,
    weights,
    bias,
    trainedAt: new Date().toISOString(),
    sampleCount: decidedApps.length,
    positiveRate,
  };

  // One model doc per recruiter (org-level, keyed by recruiterId)
  await adminDb.collection("mlModels").doc(recruiterId).set(modelPayload);

  return NextResponse.json(
    { trained: true, sampleCount: decidedApps.length, positiveRate, weights, bias },
    { status: 200 }
  );
}
