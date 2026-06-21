import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { Application, Job, User } from "@/types";

// GET /api/applications
// Recruiter-only. Returns all applications across the recruiter's jobs.
// Query params: jobId, status, minScore, maxScore, from, to (ISO date strings)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filterJobId = searchParams.get("jobId");
  const filterStatus = searchParams.get("status");
  const minScore = searchParams.get("minScore") ? Number(searchParams.get("minScore")) : null;
  const maxScore = searchParams.get("maxScore") ? Number(searchParams.get("maxScore")) : null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Resolve the set of job IDs this recruiter owns
  let jobIds: string[];

  if (filterJobId) {
    const jobSnap = await adminDb.collection("jobs").doc(filterJobId).get();
    if (!jobSnap.exists || (jobSnap.data() as Job).recruiterId !== auth.uid) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    jobIds = [filterJobId];
  } else {
    const jobsSnap = await adminDb
      .collection("jobs")
      .where("recruiterId", "==", auth.uid)
      .where("status", "!=", "deleted")
      .get();
    jobIds = jobsSnap.docs.map((d) => d.id);
  }

  if (jobIds.length === 0) {
    return NextResponse.json({ applications: [] });
  }

  // Firestore `in` supports up to 30 values — batch if needed
  const BATCH_SIZE = 30;
  const batches: string[][] = [];
  for (let i = 0; i < jobIds.length; i += BATCH_SIZE) {
    batches.push(jobIds.slice(i, i + BATCH_SIZE));
  }

  const applicationDocs = (
    await Promise.all(
      batches.map((batch) => {
        let q = adminDb.collection("applications").where("jobId", "in", batch);
        if (filterStatus) q = q.where("status", "==", filterStatus);
        return q.get();
      })
    )
  ).flatMap((snap) => snap.docs);

  let applications = applicationDocs.map((d) => d.data() as Application);

  // In-memory range filters (avoids multi-field Firestore range index requirement)
  if (minScore !== null) applications = applications.filter((a) => a.fitScore >= minScore);
  if (maxScore !== null) applications = applications.filter((a) => a.fitScore <= maxScore);
  if (from) applications = applications.filter((a) => a.createdAt >= from);
  if (to) applications = applications.filter((a) => a.createdAt <= to);

  // Default sort: fitScore descending
  applications.sort((a, b) => b.fitScore - a.fitScore);

  // Join candidate name from users collection
  const candidateIds = [...new Set(applications.map((a) => a.candidateId))];
  const userDocs = await Promise.all(
    candidateIds.map((uid) => adminDb.collection("users").doc(uid).get())
  );
  const nameByUid: Record<string, string> = {};
  for (const doc of userDocs) {
    if (doc.exists) {
      const user = doc.data() as User;
      nameByUid[doc.id] = user.name;
    }
  }

  const enriched = applications.map((a) => ({
    ...a,
    candidateName: nameByUid[a.candidateId] ?? null,
  }));

  return NextResponse.json({ applications: enriched });
}
