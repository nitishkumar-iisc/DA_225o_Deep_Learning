import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { Application, Job, Resume, User } from "@/types";

// GET /api/applications/[id]
// Accessible by the recruiter who owns the job, or the candidate who submitted the application.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const appSnap = await adminDb.collection("applications").doc(id).get();
  if (!appSnap.exists) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const application = appSnap.data() as Application;

  // Authorisation: candidate can only see their own; recruiter must own the job
  if (auth.role === "candidate") {
    if (application.candidateId !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const jobSnap = await adminDb.collection("jobs").doc(application.jobId).get();
    if (!jobSnap.exists || (jobSnap.data() as Job).recruiterId !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Join candidate, job, and resume in parallel
  const [candidateSnap, jobSnap, resumeSnap] = await Promise.all([
    adminDb.collection("users").doc(application.candidateId).get(),
    adminDb.collection("jobs").doc(application.jobId).get(),
    adminDb.collection("resumes").doc(application.resumeId).get(),
  ]);

  const candidate = candidateSnap.exists ? (candidateSnap.data() as User) : null;
  const job = jobSnap.exists ? (jobSnap.data() as Job) : null;
  const resumeUrl = resumeSnap.exists ? (resumeSnap.data() as Resume).storageUrl : null;

  return NextResponse.json({
    application,
    candidate: candidate ? { name: candidate.name, email: candidate.email } : null,
    job: job ? { title: job.title, positionId: job.positionId, department: job.department } : null,
    resumeUrl,
  });
}
