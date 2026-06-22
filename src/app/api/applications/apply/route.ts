import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { Application, Job, Resume } from "@/types";

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// POST /api/applications/apply
// Body: { jobId: string }
// Candidate applies to a specific job. Creates the application record and
// triggers fit scoring. Idempotent — re-applying returns the existing record.
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request, "candidate");
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId } = await request.json();
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

    // Verify job exists and is open
    const jobSnap = await adminDb.collection("jobs").doc(jobId).get();
    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const job = jobSnap.data() as Job;
    if (job.status !== "open") {
      return NextResponse.json({ error: "Job is not accepting applications" }, { status: 409 });
    }

    // Get candidate's active resume
    const resumesSnap = await adminDb
      .collection("resumes")
      .where("candidateId", "==", auth.uid)
      .where("active", "==", true)
      .limit(1)
      .get();

    if (resumesSnap.empty) {
      return NextResponse.json(
        { error: "Upload a resume before applying" },
        { status: 422 }
      );
    }
    const resumeDoc = resumesSnap.docs[0];
    const resume = { id: resumeDoc.id, ...resumeDoc.data() } as Resume;

    // Ensure application record exists (deterministic id prevents duplicates)
    const appId = `${auth.uid}::${jobId}`;
    const appRef = adminDb.collection("applications").doc(appId);
    let alreadyApplied = false;

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(appRef);
      if (snap.exists) {
        alreadyApplied = true;
        // Update resumeId if the candidate re-uploaded their resume
        if ((snap.data() as Application).resumeId !== resume.id) {
          tx.update(appRef, { resumeId: resume.id, updatedAt: new Date().toISOString() });
        }
        return;
      }
      const now = new Date().toISOString();
      const newApp: Application = {
        id: appId,
        candidateId: auth.uid,
        jobId,
        resumeId: resume.id,
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

    // Trigger scoring in the background (fire-and-forget)
    const baseUrl = getBaseUrl(request);
    const resumeId = resume.id;

    after(async () => {
      await fetch(`${baseUrl}/api/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, jobId, appId }),
      });
    });

    return NextResponse.json(
      { appId, alreadyApplied, status: "applied" },
      { status: alreadyApplied ? 200 : 201 }
    );
  } catch (err) {
    console.error("[applications/apply]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Apply failed" },
      { status: 500 }
    );
  }
}
