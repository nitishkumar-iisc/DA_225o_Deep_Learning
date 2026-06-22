import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { createInterviewEvent, cancelEvent } from "@/lib/google-calendar";
import { Application, GoogleTokens, Job, User } from "@/types";

// POST /api/calendar/schedule — create a Google Calendar interview event (SPEC §8.2)
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { applicationId: string; preferredDateTime?: string };
  const { applicationId, preferredDateTime } = body;
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  // Load application
  const appSnap = await adminDb.collection("applications").doc(applicationId).get();
  if (!appSnap.exists) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const application = appSnap.data() as Application;

  // Load job and verify recruiter ownership
  const jobSnap = await adminDb.collection("jobs").doc(application.jobId).get();
  if (!jobSnap.exists) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const job = jobSnap.data() as Job;
  if (job.recruiterId !== auth.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load recruiter's Google tokens
  const recruiterSnap = await adminDb.collection("users").doc(auth.uid).get();
  const recruiter = recruiterSnap.data() as User;
  if (!recruiter.googleTokens) {
    return NextResponse.json(
      { error: "Google Calendar is not connected. Visit /recruiter/settings to connect." },
      { status: 400 }
    );
  }

  // Load candidate email
  const candidateSnap = await adminDb.collection("users").doc(application.candidateId).get();
  const candidate = candidateSnap.data() as User;

  const { eventId, startTime } = await createInterviewEvent({
    recruiterTokens: recruiter.googleTokens as GoogleTokens,
    candidateEmail: candidate.email,
    recruiterEmail: recruiter.email,
    job: { title: job.title, positionId: job.positionId },
    claudeReasoning: application.claudeReasoning,
    preferredDateTime,
  });

  // Update application (SPEC §8.2)
  await appSnap.ref.update({
    status: "interview_scheduled",
    scheduledAt: startTime,
    calendarEventId: eventId,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ eventId, startTime });
}

// DELETE /api/calendar/schedule — cancel a calendar event on undo (SPEC §8.3)
export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { applicationId } = await request.json() as { applicationId: string };
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const appSnap = await adminDb.collection("applications").doc(applicationId).get();
  if (!appSnap.exists) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const application = appSnap.data() as Application;

  // Verify recruiter owns this job
  const jobSnap = await adminDb.collection("jobs").doc(application.jobId).get();
  const job = jobSnap.data() as Job;
  if (job.recruiterId !== auth.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!application.calendarEventId) {
    return NextResponse.json({ error: "No calendar event associated with this application" }, { status: 400 });
  }

  const recruiterSnap = await adminDb.collection("users").doc(auth.uid).get();
  const recruiter = recruiterSnap.data() as User;
  if (!recruiter.googleTokens) {
    return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
  }

  await cancelEvent(recruiter.googleTokens as GoogleTokens, application.calendarEventId);

  // Clear calendar fields and revert status to "approved"
  await appSnap.ref.update({
    status: "approved",
    scheduledAt: null,
    calendarEventId: null,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
