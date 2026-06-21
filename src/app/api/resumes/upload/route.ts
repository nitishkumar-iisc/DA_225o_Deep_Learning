import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { adminDb, getAdminStorage } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { parseResumeFromPDF } from "@/lib/anthropic";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// POST /api/resumes/upload
// Accepts multipart/form-data with a "file" field (PDF).
// Parses the resume in-memory via Claude. Persists raw PDF to Storage as
// a best-effort background step. No auto-apply fan-out — candidates choose
// which jobs to apply to via the Apply Now button on the dashboard.
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request, "candidate");
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be ≤ 5 MB" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse with Claude directly from the PDF buffer (no PDF library needed)
    let parsedData;
    try {
      parsedData = await parseResumeFromPDF(buffer);
    } catch (err) {
      console.error("[resumes/upload] Claude parse failed:", err);
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
    const storagePath = `resumes/${auth.uid}/${Date.now()}.pdf`;

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
        await getAdminStorage().file(storagePath).save(buffer, { contentType: "application/pdf" });
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
