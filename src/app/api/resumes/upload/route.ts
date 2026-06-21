import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb, getAdminStorage } from "@/lib/firebase-admin";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// POST /api/resumes/upload
// Accepts multipart/form-data with a "file" field (PDF).
// Uploads directly to Firebase Storage server-side — avoids CORS on signed URLs.
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
      parsedData: null,
      active: true,
      uploadedAt: new Date().toISOString(),
    });

    await batch.commit();

    // Upload to Firebase Storage server-side (no CORS issues)
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageFile = getAdminStorage().file(storagePath);
    await storageFile.save(buffer, { contentType: "application/pdf" });

    return NextResponse.json({ resumeId: resumeDoc.id, storagePath });
  } catch (err) {
    console.error("[resumes/upload]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
