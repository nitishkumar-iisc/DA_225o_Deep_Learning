import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { Job, MLModel, Application } from "@/types";

const MIN_EXAMPLES = 5;

export interface JobMLStatus {
  jobId: string;
  jobTitle: string;
  positionId: string;
  model: MLModel | null;
  totalDecisions: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  decisionsNeeded: number;
  isTrained: boolean;
}

// GET /api/ml/status
// Returns ML model status for every job owned by the authenticated recruiter.
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobsSnap = await adminDb
    .collection("jobs")
    .where("recruiterId", "==", auth.uid)
    .get();

  const jobs = jobsSnap.docs
    .map((d) => d.data() as Job)
    .filter((j) => j.status !== "deleted");

  if (jobs.length === 0) return NextResponse.json({ models: [] });

  const statuses: JobMLStatus[] = await Promise.all(
    jobs.map(async (job) => {
      const [modelSnap, appsSnap] = await Promise.all([
        adminDb.collection("mlModels").doc(job.id).get(),
        adminDb.collection("applications").where("jobId", "==", job.id).get(),
      ]);

      const model = modelSnap.exists ? (modelSnap.data() as MLModel) : null;
      const apps = appsSnap.docs.map((d) => d.data() as Application);

      const approvedCount = apps.filter((a) => a.decision === "approved").length;
      const rejectedCount = apps.filter((a) => a.decision === "rejected").length;
      const totalDecisions = approvedCount + rejectedCount;
      const pendingCount = apps.filter((a) => !a.decision).length;

      return {
        jobId: job.id,
        jobTitle: job.title,
        positionId: job.positionId,
        model,
        totalDecisions,
        approvedCount,
        rejectedCount,
        pendingCount,
        decisionsNeeded: Math.max(0, MIN_EXAMPLES - totalDecisions),
        isTrained: model !== null,
      };
    })
  );

  statuses.sort((a, b) => {
    if (a.isTrained !== b.isTrained) return a.isTrained ? -1 : 1;
    return b.totalDecisions - a.totalDecisions;
  });

  return NextResponse.json({ models: statuses });
}
