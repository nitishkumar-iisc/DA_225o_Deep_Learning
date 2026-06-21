import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { Application, Decision, Job } from "@/types";

const UNDO_WINDOW_MS = 30 * 60 * 1000; // 30 minutes (SPEC §4.3)

// PATCH /api/applications/[id]/decide — approve, reject, or undo (SPEC §4.3)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json() as { decision: Decision };
  const { decision } = body;

  if (!["approved", "rejected", "undo"].includes(decision)) {
    return NextResponse.json({ error: "decision must be approved | rejected | undo" }, { status: 400 });
  }

  const appRef = adminDb.collection("applications").doc(id);
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const application = appSnap.data() as Application;

  // Verify the recruiter owns the job this application is for
  const jobSnap = await adminDb.collection("jobs").doc(application.jobId).get();
  if (!jobSnap.exists) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const job = jobSnap.data() as Job;
  if (job.recruiterId !== auth.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Undo path ──────────────────────────────────────────────────────────────
  if (decision === "undo") {
    if (!application.decidedAt) {
      return NextResponse.json({ error: "No decision to undo" }, { status: 400 });
    }

    // Server-side 30-minute lock (SPEC §4.3, §10)
    const elapsed = Date.now() - new Date(application.decidedAt).getTime();
    if (elapsed > UNDO_WINDOW_MS) {
      return NextResponse.json(
        { error: "Undo window has expired (30 minutes)" },
        { status: 409 }
      );
    }

    // Cancel the calendar event if one was created (SPEC §8.3)
    if (application.calendarEventId) {
      const origin = new URL(request.url).origin;
      try {
        await fetch(`${origin}/api/calendar/schedule`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: request.headers.get("Authorization") ?? "",
            Cookie: request.headers.get("cookie") ?? "",
          },
          body: JSON.stringify({ applicationId: id }),
        });
      } catch {
        // Calendar cancellation failure should not block the undo
      }
    }

    await appRef.update({
      decision: null,
      status: "pending",
      decidedAt: null,
      scheduledAt: null,
      calendarEventId: null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, decision: "undo" });
  }

  // ── Approve / Reject path ──────────────────────────────────────────────────
  const now = new Date().toISOString();

  await appRef.update({
    decision,
    status: decision === "approved" ? "approved" : "rejected",
    decidedAt: now,
    updatedAt: now,
  });

  const origin = new URL(request.url).origin;
  const authHeader = request.headers.get("Authorization") ?? "";
  const cookieHeader = request.headers.get("cookie") ?? "";

  // Trigger ML retraining in the background (SPEC §4.3)
  fetch(`${origin}/api/ml/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({ jobId: application.jobId }),
  }).catch(() => {});

  // Trigger calendar scheduling for approved candidates (SPEC §4.3, §8.2)
  if (decision === "approved") {
    fetch(`${origin}/api/calendar/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ applicationId: id }),
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, decision, decidedAt: now });
}
