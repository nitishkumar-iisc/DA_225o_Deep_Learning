import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { train, defaultWeights } from "@/lib/ml-model";
import { Application, MLModel } from "@/types";

const MIN_EXAMPLES = 5;

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// POST /api/ml/train — internal endpoint; called after recruiter decision (SPEC §7.2)
// Body: { jobId: string }
export async function POST(request: NextRequest) {
  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId } = body;
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  // Load all decided applications for this job (Admin SDK)
  const decidedSnap = await adminDb
    .collection("applications")
    .where("jobId", "==", jobId)
    .where("decision", "!=", null)
    .get();

  const decidedApps = decidedSnap.docs.map((d) => d.data() as Application);

  // Minimum 5 labelled examples required before training (SPEC §7.2)
  if (decidedApps.length < MIN_EXAMPLES) {
    return NextResponse.json(
      {
        skipped: true,
        reason: `Need at least ${MIN_EXAMPLES} decisions; have ${decidedApps.length}`,
        sampleCount: decidedApps.length,
      },
      { status: 200 }
    );
  }

  // Map labels: approved → 1, rejected → 0 (SPEC §7.2)
  const trainingExamples = decidedApps.map((app) => ({
    features: [
      app.featureVector.keywordMatchScore,
      app.featureVector.experienceMatchScore,
      app.featureVector.educationScore,
      app.featureVector.skillsOverlapScore,
      app.featureVector.claudeRawScore,
    ],
    label: app.decision === "approved" ? 1 : 0,
  }));

  const { weights, bias } = train(trainingExamples);

  const approvedCount = decidedApps.filter((a) => a.decision === "approved").length;
  const positiveRate = approvedCount / decidedApps.length;

  const modelPayload: MLModel = {
    jobId,
    weights,
    bias,
    trainedAt: new Date().toISOString(),
    sampleCount: decidedApps.length,
    positiveRate,
  };

  // Persist trained model to Firestore (SPEC §7.3)
  await adminDb.collection("mlModels").doc(jobId).set(modelPayload);

  // Fan-out: re-score all pending applications for this job (fire-and-forget, SPEC §5.1)
  const baseUrl = getBaseUrl(request);

  after(async () => {
    const pendingSnap = await adminDb
      .collection("applications")
      .where("jobId", "==", jobId)
      .where("status", "==", "pending")
      .get();

    await Promise.allSettled(
      pendingSnap.docs.map((doc) => {
        const app = doc.data() as Application;
        return fetch(`${baseUrl}/api/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeId: app.resumeId,
            jobId: app.jobId,
            appId: app.id,
          }),
        });
      })
    );
  });

  return NextResponse.json(
    {
      trained: true,
      sampleCount: decidedApps.length,
      positiveRate,
      weights,
      bias,
    },
    { status: 200 }
  );
}
