import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { Application, Job, JobEducationLevel, JobStatus, Resume } from "@/types";

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

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
    .where("status", "!=", "deleted")
    .orderBy("createdAt", "desc")
    .get();

  const jobs: Job[] = snapshot.docs.map((doc) => doc.data() as Job);
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
    !department ||
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

  await adminDb.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const seq: number = counterSnap.exists ? (counterSnap.data()!.seq as number) + 1 : 1;
    tx.set(counterRef, { seq }, { merge: true });

    const now = new Date().toISOString();
    const job: Job = {
      id: jobRef.id,
      positionId: `BH-${year}-${String(seq).padStart(4, "0")}`,
      title,
      department,
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
  });

  const jobSnap = await jobRef.get();
  const job = jobSnap.data() as Job;

  // P5: Fan-out — score all candidates with active resumes against this new job (fire-and-forget)
  const baseUrl = getBaseUrl(request);
  const jobId = job.id;

  after(async () => {
    const activeResumesSnap = await adminDb
      .collection("resumes")
      .where("active", "==", true)
      .get();

    const activeResumes = activeResumesSnap.docs.map((d) => d.data() as Resume);

    await Promise.allSettled(
      activeResumes
        .filter((r) => r.parsedData !== null)
        .map(async (resume) => {
          const appId = await ensureApplication(resume.candidateId, jobId, resume.id);
          return fetch(`${baseUrl}/api/score`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resumeId: resume.id, jobId, appId }),
          });
        })
    );
  });

  return NextResponse.json({ job, positionId: job.positionId }, { status: 201 });
}
