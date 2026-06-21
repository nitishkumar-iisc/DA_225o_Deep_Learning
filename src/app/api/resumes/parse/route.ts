import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { adminDb, getAdminStorage } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { parseResume } from "@/lib/anthropic";
import { Application, Job, Resume } from "@/types";

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// POST /api/resumes/parse
// Body: { resumeId: string, storageUrl: string }
// Parses the PDF via Firebase Storage SDK, saves parsedData, then fans out scoring.
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request, "candidate");
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { resumeId, storageUrl } = await request.json();

    if (!resumeId || !storageUrl) {
      return NextResponse.json({ error: "resumeId and storageUrl are required" }, { status: 400 });
    }

    // Verify resume belongs to this candidate
    const resumeRef = adminDb.collection("resumes").doc(resumeId);
    const resumeDoc = await resumeRef.get();
    if (!resumeDoc.exists || (resumeDoc.data() as Resume).candidateId !== auth.uid) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    // Download PDF from Firebase Storage using Admin SDK (storageUrl is the storage file path)
    const bucket = getAdminStorage();
    const file = bucket.file(storageUrl);
    const [buffer] = await file.download();

    // Extract text and check it's non-empty
    const pdfParse = await import("pdf-parse");
    const parseFn = (pdfParse as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default
      ?? (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>);
    const pdfData = await parseFn(buffer);

    if (!pdfData.text.trim()) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
    }

    // Parse with Claude
    let parsedData;
    try {
      parsedData = await parseResume(pdfData.text);
    } catch (err) {
      console.error("[resumes/parse] Claude parse failed:", err);
      return NextResponse.json({ error: "Resume parsing failed" }, { status: 502 });
    }

    // Save parsedData to Firestore
    await resumeRef.update({ parsedData });

    // P5: Fan-out — score this resume against every open job (fire-and-forget)
    const baseUrl = getBaseUrl(request);
    const candidateId = auth.uid;

    after(async () => {
      const openJobsSnap = await adminDb
        .collection("jobs")
        .where("status", "==", "open")
        .get();

      const openJobs = openJobsSnap.docs.map((d) => d.data() as Job);

      await Promise.allSettled(
        openJobs.map(async (job) => {
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
    console.error("[resumes/parse]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parse failed" },
      { status: 500 }
    );
  }
}

// Creates the application document if it doesn't already exist.
// Deterministic ID (candidateId::jobId) lets the transaction use a DocumentReference
// get — Firestore transactions don't support queries.
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
    const newApp: Application = {
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
    };
    tx.set(appRef, newApp);
  });

  return appId;
}
