import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { UserRole } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role } = await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: "email, password, name, and role are required" },
        { status: 400 }
      );
    }

    if (role !== "candidate" && role !== "recruiter") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const userRecord = await adminAuth.createUser({ email, password });

    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role: role as UserRole,
    });

    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ uid: userRecord.uid, role }, { status: 201 });
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
