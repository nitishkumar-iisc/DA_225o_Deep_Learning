import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, "candidate");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("resumes")
    .where("candidateId", "==", auth.uid)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return NextResponse.json({ active: false });

  const doc = snap.docs[0];
  return NextResponse.json({ active: true, resumeId: doc.id, ...doc.data() });
}
