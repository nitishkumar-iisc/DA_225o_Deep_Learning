import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { Application, Job, Resume, User } from "@/types";

function skillsAnalysis(candidateSkills: string[], jobSkills: string[]) {
  const normalize = (s: string) => s.toLowerCase().trim();
  const candidateSet = new Set(candidateSkills.map(normalize));
  const jobSet = new Set(jobSkills.map(normalize));

  const matched = jobSkills.filter((s) => candidateSet.has(normalize(s)));
  const missing = jobSkills.filter((s) => !candidateSet.has(normalize(s)));
  const extra = candidateSkills.filter((s) => !jobSet.has(normalize(s)));

  return { matched, missing, extra };
}

function experienceAnalysis(candidateYears: number, requiredYears: number) {
  const gap = candidateYears - requiredYears;
  const status: "exceeds" | "meets" | "below" =
    gap > 0 ? "exceeds" : gap === 0 ? "meets" : "below";
  return { required: requiredYears, candidate: candidateYears, gap, status };
}

const EDU_ORDER = ["none", "bachelor", "master", "phd"];
function educationAnalysis(candidateLevel: string, requiredLevel: string) {
  const candidateOrd = EDU_ORDER.indexOf(candidateLevel);
  const requiredOrd = EDU_ORDER.indexOf(requiredLevel);
  const status: "exceeds" | "meets" | "below" =
    candidateOrd > requiredOrd ? "exceeds" : candidateOrd === requiredOrd ? "meets" : "below";
  return { required: requiredLevel, candidate: candidateLevel, status };
}

// GET /api/applications/[id]/analysis
// Recruiter-only: returns structured fitment analysis derived from stored data.
// No extra Claude call — uses featureVector, parsedResume, job requirements.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const appSnap = await adminDb.collection("applications").doc(id).get();
  if (!appSnap.exists) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const application = appSnap.data() as Application;

  // Verify recruiter owns the job
  const jobSnap = await adminDb.collection("jobs").doc(application.jobId).get();
  if (!jobSnap.exists) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const job = jobSnap.data() as Job;
  if (job.recruiterId !== auth.uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [candidateSnap, resumeSnap] = await Promise.all([
    adminDb.collection("users").doc(application.candidateId).get(),
    adminDb.collection("resumes").doc(application.resumeId).get(),
  ]);

  const candidate = candidateSnap.exists ? (candidateSnap.data() as User) : null;
  const resume = resumeSnap.exists ? (resumeSnap.data() as Resume) : null;
  const parsed = resume?.parsedData;

  const skills = skillsAnalysis(parsed?.skills ?? [], job.requiredSkills ?? []);
  const experience = experienceAnalysis(parsed?.experienceYears ?? 0, job.requiredExperienceYears ?? 0);
  const education = educationAnalysis(parsed?.educationLevel ?? "none", job.educationLevel ?? "any");

  return NextResponse.json({
    fitScore: application.fitScore,
    featureVector: application.featureVector,
    claudeReasoning: application.claudeReasoning,
    candidate: candidate ? { name: candidate.name, email: candidate.email } : null,
    job: { title: job.title, positionId: job.positionId, department: job.department },
    skills,
    experience,
    education,
    workHistory: parsed?.workHistory ?? [],
    summary: parsed?.summary ?? null,
  });
}

// POST /api/applications/[id]/analysis
// Re-triggers the scoring pipeline to refresh analysis data.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const appSnap = await adminDb.collection("applications").doc(id).get();
  if (!appSnap.exists) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const application = appSnap.data() as Application;

  const jobSnap = await adminDb.collection("jobs").doc(application.jobId).get();
  if (!jobSnap.exists) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if ((jobSnap.data() as Job).recruiterId !== auth.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const origin = new URL(request.url).origin;
  const scoreRes = await fetch(`${origin}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resumeId: application.resumeId,
      jobId: application.jobId,
      appId: id,
    }),
  });

  if (!scoreRes.ok) {
    return NextResponse.json({ error: "Re-scoring failed" }, { status: 502 });
  }

  return NextResponse.json({ refreshed: true });
}
