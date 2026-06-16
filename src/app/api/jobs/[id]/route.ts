import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { Job, JobStatus } from "@/types";

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ["open", "deleted"],
  open: ["closed", "deleted"],
  closed: ["open", "deleted"],
  deleted: [],
};

const MUTABLE_FIELDS = ["title", "department", "description", "requiredSkills", "requiredExperienceYears", "educationLevel", "status"];

async function getJobForRecruiter(jobId: string, recruiterId: string) {
  const doc = await adminDb.collection("jobs").doc(jobId).get();
  if (!doc.exists) return null;
  const job = doc.data() as Job;
  if (job.recruiterId !== recruiterId) return null;
  return { doc, job };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getJobForRecruiter(id, auth.uid);
  if (!result) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = await request.json();

  if ("positionId" in body) {
    return NextResponse.json({ error: "positionId cannot be changed" }, { status: 400 });
  }

  if (body.status && !VALID_TRANSITIONS[result.job.status].includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status transition: ${result.job.status} → ${body.status}` },
      { status: 400 }
    );
  }

  const updates: Partial<Job> = { updatedAt: new Date().toISOString() };
  for (const field of MUTABLE_FIELDS) {
    if (field in body) {
      (updates as Record<string, unknown>)[field] = body[field];
    }
  }

  await result.doc.ref.update(updates);
  const updated = await result.doc.ref.get();
  return NextResponse.json({ job: updated.data() });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getJobForRecruiter(id, auth.uid);
  if (!result) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (result.job.status === "deleted") {
    return NextResponse.json({ error: "Job already deleted" }, { status: 400 });
  }

  await result.doc.ref.update({
    status: "deleted",
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
