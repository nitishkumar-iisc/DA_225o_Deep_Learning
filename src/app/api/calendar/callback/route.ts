import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { exchangeCode } from "@/lib/google-calendar";
import { adminDb } from "@/lib/firebase-admin";

// Derive the public app origin from GOOGLE_REDIRECT_URI so redirects work
// correctly behind Render's proxy (request.url resolves to localhost:PORT).
function appOrigin(): string {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";
  try {
    return new URL(redirectUri).origin;
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  const origin = appOrigin();
  const base = origin || request.url;

  const auth = await verifyAuth(request, "recruiter");
  if (!auth) {
    return NextResponse.redirect(new URL("/login", base));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    const url = new URL("/recruiter/settings", base);
    url.searchParams.set("calendar_error", error ?? "missing_code");
    return NextResponse.redirect(url);
  }

  const tokens = await exchangeCode(code);

  // Store tokens in Firestore against the recruiter's uid (SPEC §8.1)
  await adminDb.collection("users").doc(auth.uid).update({
    googleTokens: tokens,
  });

  return NextResponse.redirect(new URL("/recruiter/settings?calendar_connected=1", base));
}
