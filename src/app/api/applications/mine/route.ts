import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";

// Returns all applications for the authenticated candidate, with job title + positionId joined
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, "candidate");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("applications")
    .where("candidateId", "==", auth.uid)
    .get();

  const applications = await Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data();
      const jobSnap = await adminDb.collection("jobs").doc(data.jobId).get();
      const job = jobSnap.exists
        ? { title: jobSnap.data()!.title, positionId: jobSnap.data()!.positionId }
        : { title: "Unknown", positionId: "" };
      return { id: doc.id, ...data, job };
    })
  );

  return NextResponse.json(applications);
}
