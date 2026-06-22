import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { Application, Job, JobEducationLevel, JobStatus } from "@/types";


// Creates an application document for (candidateId, jobId) if it doesn't exist yet.
// Deterministic ID prevents duplicates under concurrent requests (SPEC §10).
async function ensureApplication(
  candidateId: string,
  jobId: string,
  resumeId: string
): Promise<string> {
  const appId = `${candidateId}::${jobId}`;
  const appRef = adminDb.collection("applications").doc(appId);

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(appRef);
    if (snap.exists) {
      if ((snap.data() as Application).resumeId !== resumeId) {
        tx.update(appRef, { resumeId, updatedAt: new Date().toISOString() });
      }
      return;
    }

    const now = new Date().toISOString();
    const newApp: Application = {
      id: appId,
      candidateId,
      jobId,
      resumeId,
      fitScore: 0,
      featureVector: {
        keywordMatchScore: 0,
        experienceMatchScore: 0,
        educationScore: 0,
        skillsOverlapScore: 0,
        claudeRawScore: 0,
      },
      claudeReasoning: null,
      status: "pending",
      decision: null,
      decidedAt: null,
      scheduledAt: null,
      calendarEventId: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(appRef, newApp);
  });

  return appId;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await adminDb
    .collection("jobs")
    .where("recruiterId", "==", auth.uid)
    .get();

  const jobs: Job[] = snapshot.docs
    .map((doc) => doc.data() as Job)
    .filter((j) => j.status !== "deleted")
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, department, description, requiredSkills, requiredExperienceYears, educationLevel } =
    body;

  if (
    !title ||
    !description ||
    !requiredSkills ||
    requiredExperienceYears === undefined ||
    !educationLevel
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const counterId = `jobs_${auth.uid}_${year}`;
  const counterRef = adminDb.collection("counters").doc(counterId);
  const jobRef = adminDb.collection("jobs").doc();

  try { await adminDb.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const seq: number = counterSnap.exists ? (counterSnap.data()!.seq as number) + 1 : 1;
    tx.set(counterRef, { seq }, { merge: true });

    const now = new Date().toISOString();
    const job: Job = {
      id: jobRef.id,
      positionId: `BH-${year}-${String(seq).padStart(4, "0")}`,
      title,
      department: department ?? null,
      description,
      requiredSkills: requiredSkills as string[],
      requiredExperienceYears: Number(requiredExperienceYears),
      educationLevel: educationLevel as JobEducationLevel,
      recruiterId: auth.uid,
      status: "open" as JobStatus,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(jobRef, job);
  }); } catch (err) {
    console.error("POST /api/jobs transaction error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const jobSnap = await jobRef.get();
  const job = jobSnap.data() as Job;

  // No auto-fan-out: candidates choose which jobs to apply to via the Apply Now button.
  // New jobs appear in "Open Positions" on the candidate dashboard until explicitly applied.

  return NextResponse.json({ job, positionId: job.positionId }, { status: 201 });
}
