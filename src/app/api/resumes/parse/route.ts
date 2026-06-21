import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-helpers";
import { parseResume } from "@/lib/anthropic";
import { Application, Job, Resume } from "@/types";

type PdfParseResult = { text: string; numpages: number; info: unknown };
type PdfParseFn = (buf: Buffer) => Promise<PdfParseResult>;

// Dynamic import to avoid bundling pdf-parse on the edge
async function extractPdfText(buffer: Buffer): Promise<string> {
  const mod = await import("pdf-parse");
  // pdf-parse can ship as CJS default or ESM named export depending on bundler
  const parseFn: PdfParseFn =
    (mod as unknown as { default: PdfParseFn }).default ??
    (mod as unknown as PdfParseFn);
  const data = await parseFn(buffer);
  return data.text;
}

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// POST /api/resumes/parse
// Body: { resumeId: string, storageUrl: string }
// Parses the PDF, saves parsedData to Firestore, then fans out scoring for all open jobs.
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request, "candidate");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { resumeId?: string; storageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { resumeId, storageUrl } = body;
  if (!resumeId || !storageUrl) {
    return NextResponse.json({ error: "resumeId and storageUrl are required" }, { status: 400 });
  }

  // Verify the resume belongs to the authenticated candidate
  const resumeSnap = await adminDb.collection("resumes").doc(resumeId).get();
  if (!resumeSnap.exists) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }
  const resume = resumeSnap.data() as Resume;
  if (resume.candidateId !== auth.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Download PDF from Firebase Storage URL
  let pdfBuffer: Buffer;
  try {
    const response = await fetch(storageUrl);
    if (!response.ok) throw new Error(`Storage fetch failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    pdfBuffer = Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("[resumes/parse] PDF download failed:", err);
    return NextResponse.json({ error: "Failed to download resume PDF" }, { status: 502 });
  }

  // Extract text from PDF
  let pdfText: string;
  try {
    pdfText = await extractPdfText(pdfBuffer);
  } catch (err) {
    console.error("[resumes/parse] PDF text extraction failed:", err);
    return NextResponse.json({ error: "Failed to extract PDF text" }, { status: 422 });
  }

  // Parse with Claude
  let parsedData;
  try {
    parsedData = await parseResume(pdfText);
  } catch (err) {
    console.error("[resumes/parse] Claude parse failed:", err);
    return NextResponse.json({ error: "Resume parsing failed" }, { status: 502 });
  }

  // Save parsedData to Firestore
  const now = new Date().toISOString();
  await adminDb.collection("resumes").doc(resumeId).update({
    parsedData,
    updatedAt: now,
  });

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
        // Ensure an application document exists for this (candidateId, jobId) pair
        const appId = await ensureApplication(candidateId, job.id, resumeId);

        // Score the application
        return fetch(`${baseUrl}/api/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId, jobId: job.id, appId }),
        });
      })
    );
  });

  return NextResponse.json({ resumeId, parsedData }, { status: 200 });
}

// Creates the application document if it doesn't already exist.
// Uses a deterministic document ID (candidateId::jobId) so the Firestore transaction
// can use a DocumentReference get — transactions don't support queries.
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
      // Keep resumeId current if candidate re-uploaded their resume
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
