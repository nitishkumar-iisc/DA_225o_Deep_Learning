import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { exchangeCode } from "@/lib/google-calendar";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    // User denied access or something went wrong — redirect back to settings
    const url = new URL("/recruiter/settings", request.url);
    url.searchParams.set("calendar_error", error ?? "missing_code");
    return NextResponse.redirect(url);
  }

  const tokens = await exchangeCode(code);

  // Store tokens in Firestore against the recruiter's uid (SPEC §8.1)
  await adminDb.collection("users").doc(auth.uid).update({
    googleTokens: tokens,
  });

  return NextResponse.redirect(new URL("/recruiter/settings?calendar_connected=1", request.url));
}
