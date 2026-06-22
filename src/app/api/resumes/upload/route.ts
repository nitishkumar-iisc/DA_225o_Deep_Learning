import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { adminDb, getAdminStorage } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { parseResumeFromPDF, parseResumeFromDocx, parseResumeFromText } from "@/lib/anthropic";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const ACCEPTED_TYPES: Record<string, { ext: string; label: string }> = {
  "application/pdf": { ext: "pdf", label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", label: "DOCX" },
  "application/msword": { ext: "doc", label: "DOC" },
  "text/plain": { ext: "txt", label: "TXT" },
};

// POST /api/resumes/upload
// Accepts multipart/form-data with a "file" field (PDF, DOCX, DOC, TXT ≤ 5 MB).
// PDF  → Claude native document API (best quality)
// DOCX/DOC → mammoth text extraction → Claude text API
// TXT  → Claude text API directly
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request, "candidate");
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileType = ACCEPTED_TYPES[file.type];
    if (!fileType) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF, DOCX, DOC, or TXT file." },
        { status: 415 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be ≤ 5 MB" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Route to the correct parser based on file type
    let parsedData;
    try {
      if (file.type === "application/pdf") {
        parsedData = await parseResumeFromPDF(buffer);
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/msword"
      ) {
        parsedData = await parseResumeFromDocx(buffer);
      } else {
        parsedData = await parseResumeFromText(buffer);
      }
    } catch (err) {
      console.error("[resumes/upload] parse failed:", err);
      return NextResponse.json({ error: "Resume parsing failed" }, { status: 502 });
    }

    // Mark previous active resume as inactive
    const resumesRef = adminDb.collection("resumes");
    const activeResumes = await resumesRef
      .where("candidateId", "==", auth.uid)
      .where("active", "==", true)
      .get();

    const batch = adminDb.batch();
    activeResumes.docs.forEach((doc) => batch.update(doc.ref, { active: false }));

    const resumeDoc = resumesRef.doc();
    const storagePath = `resumes/${auth.uid}/${Date.now()}.${fileType.ext}`;

    batch.set(resumeDoc, {
      candidateId: auth.uid,
      storageUrl: storagePath,
      parsedData,
      active: true,
      uploadedAt: new Date().toISOString(),
    });

    await batch.commit();

    // Best-effort Storage save in the background (non-blocking)
    after(async () => {
      try {
        await getAdminStorage().file(storagePath).save(buffer, { contentType: file.type });
      } catch (err) {
        console.warn("[resumes/upload] Storage save failed (non-fatal):", err);
      }
    });

    return NextResponse.json({ resumeId: resumeDoc.id, parsedData });
  } catch (err) {
    console.error("[resumes/upload]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
