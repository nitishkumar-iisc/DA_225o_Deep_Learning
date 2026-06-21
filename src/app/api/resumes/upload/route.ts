import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb, getAdminStorage } from "@/lib/firebase-admin";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request, "candidate");
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { contentType, fileSize } = await request.json();

    if (contentType !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }

    if (!fileSize || fileSize > MAX_SIZE) {
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

    // Create new resume document
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

    // Generate signed upload URL
    const bucket = getAdminStorage();
    const file = bucket.file(storagePath);
    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: "application/pdf",
    });

    return NextResponse.json({ uploadUrl: signedUrl, resumeId: resumeDoc.id, storagePath });
  } catch (err) {
    console.error("[resumes/upload]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload setup failed" },
      { status: 500 }
    );
  }
}
