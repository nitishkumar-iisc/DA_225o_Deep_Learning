import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import pdf from "pdf-parse";
import { verifyAuth } from "@/lib/auth-helpers";
import adminApp, { adminDb } from "@/lib/firebase-admin";
import { parseResume } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request, "candidate");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resumeId, storageUrl } = await request.json();

  if (!resumeId || !storageUrl) {
    return NextResponse.json({ error: "resumeId and storageUrl are required" }, { status: 400 });
  }

  // Verify resume belongs to this candidate
  const resumeRef = adminDb.collection("resumes").doc(resumeId);
  const resumeDoc = await resumeRef.get();
  if (!resumeDoc.exists || resumeDoc.data()?.candidateId !== auth.uid) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  // Download PDF from Storage
  const bucket = getStorage(adminApp).bucket();
  const file = bucket.file(storageUrl);
  const [buffer] = await file.download();

  // Extract text from PDF
  const pdfData = await pdf(buffer);
  if (!pdfData.text.trim()) {
    return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
  }

  // Call Claude to parse resume
  const parsedData = await parseResume(pdfData.text);

  // Save parsed data to Firestore
  await resumeRef.update({ parsedData });

  // TODO: P5 adds scoring fan-out here

  return NextResponse.json({ resumeId, parsedData });
}
