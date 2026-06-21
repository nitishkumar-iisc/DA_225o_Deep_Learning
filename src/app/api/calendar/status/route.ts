import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { User } from "@/types";

// GET /api/calendar/status — check whether the recruiter has connected Google Calendar
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snap = await adminDb.collection("users").doc(auth.uid).get();
  const user = snap.data() as User | undefined;

  const connected = !!(user?.googleTokens?.access_token);
  return NextResponse.json({ connected });
}
