import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { adminDb, getAdminStorage } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { parseResume } from "@/lib/anthropic";
import { Application, Job } from "@/types";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// POST /api/resumes/upload
// Accepts multipart/form-data with a "file" field (PDF).
// Parses the resume in-memory — no Firebase Storage download needed.
// Attempts to persist the raw PDF to Storage as a best-effort background step.
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

    // Read file buffer once — reuse for both pdf-parse and Storage upload
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text from PDF
    const pdfParse = await import("pdf-parse");
    const parseFn = (
      pdfParse as unknown as { default: (b: Buffer) => Promise<{ text: string }> }
    ).default ?? (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>);
    const pdfData = await parseFn(buffer);

    if (!pdfData.text.trim()) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
    }

    // Parse with Claude
    let parsedData;
    try {
      parsedData = await parseResume(pdfData.text);
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

    // Fan-out scoring + best-effort Storage save (fire-and-forget)
    const baseUrl = getBaseUrl(request);
    const candidateId = auth.uid;
    const resumeId = resumeDoc.id;

    after(async () => {
      // Persist raw PDF to Storage if bucket is available
      try {
        await getAdminStorage().file(storagePath).save(buffer, { contentType: "application/pdf" });
      } catch (err) {
        console.warn("[resumes/upload] Storage save failed (non-fatal):", err);
      }

      // Score against all open jobs
      const openJobsSnap = await adminDb
        .collection("jobs")
        .where("status", "==", "open")
        .get();

      await Promise.allSettled(
        openJobsSnap.docs.map(async (doc) => {
          const job = doc.data() as Job;
          const appId = await ensureApplication(candidateId, job.id, resumeId);
          return fetch(`${baseUrl}/api/score`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resumeId, jobId: job.id, appId }),
          });
        })
      );
    });

    return NextResponse.json({ resumeId, parsedData });
  } catch (err) {
    console.error("[resumes/upload]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

async function ensureApplication(
  candidateId: string,
  jobId: string,
  resumeId: string
): Promise<string> {
  const appId = `${candidateId}::${jobId}`;
  const appRef = adminDb.collection("applications").doc(appId);

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(appRef);
    if (snap.exists) {
      if ((snap.data() as Application).resumeId !== resumeId) {
        tx.update(appRef, { resumeId, updatedAt: new Date().toISOString() });
      }
      return;
    }
    const now = new Date().toISOString();
    tx.set(appRef, {
      id: appId,
      candidateId,
      jobId,
      resumeId,
      fitScore: 0,
      featureVector: {
        keywordMatchScore: 0,
        experienceMatchScore: 0,
        educationScore: 0,
        skillsOverlapScore: 0,
        claudeRawScore: 0,
      },
      claudeReasoning: null,
      status: "pending",
      decision: null,
      decidedAt: null,
      scheduledAt: null,
      calendarEventId: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return appId;
}
