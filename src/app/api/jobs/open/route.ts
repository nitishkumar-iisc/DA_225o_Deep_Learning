import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { Job } from "@/types";

// GET /api/jobs/open
// Returns all open jobs for candidates.
// Candidates can see open jobs regardless of whether they have an application yet.
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, "candidate");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("jobs")
    .where("status", "==", "open")
    .get();

  const jobs: Job[] = snap.docs
    .map((doc) => doc.data() as Job)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  return NextResponse.json({ jobs });
}
