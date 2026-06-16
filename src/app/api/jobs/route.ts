import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { Job, JobEducationLevel, JobStatus } from "@/types";

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
  const { title, department, description, requiredSkills, requiredExperienceYears, educationLevel } = body;

  if (!title || !department || !description || !requiredSkills || requiredExperienceYears === undefined || !educationLevel) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const counterId = `jobs_${auth.uid}_${year}`;
  const counterRef = adminDb.collection("counters").doc(counterId);
  const jobRef = adminDb.collection("jobs").doc();

  const positionId = await adminDb.runTransaction(async (tx) => {
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
    return job.positionId;
  });

  const jobSnap = await jobRef.get();
  return NextResponse.json({ job: jobSnap.data(), positionId }, { status: 201 });
}
