import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { Job, MLModel, Application } from "@/types";

const MIN_EXAMPLES = 5;

export interface OrgMLStatus {
  model: MLModel | null;
  isTrained: boolean;
  totalDecisions: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  decisionsNeeded: number;       // 0 once trained
  jobCount: number;              // total open/closed jobs for this recruiter
  jobBreakdown: JobDecisionCount[];
}

export interface JobDecisionCount {
  jobId: string;
  jobTitle: string;
  positionId: string;
  approved: number;
  rejected: number;
  pending: number;
}

// GET /api/ml/status
// Returns org-level ML model status for the authenticated recruiter.
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, "recruiter");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [modelSnap, jobsSnap] = await Promise.all([
    adminDb.collection("mlModels").doc(auth.uid).get(),
    adminDb.collection("jobs").where("recruiterId", "==", auth.uid).get(),
  ]);

  const model = modelSnap.exists ? (modelSnap.data() as MLModel) : null;
  const jobs = jobsSnap.docs
    .map((d) => d.data() as Job)
    .filter((j) => j.status !== "deleted");

  if (jobs.length === 0) {
    const status: OrgMLStatus = {
      model: null,
      isTrained: false,
      totalDecisions: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      decisionsNeeded: MIN_EXAMPLES,
      jobCount: 0,
      jobBreakdown: [],
    };
    return NextResponse.json({ status });
  }

  // Fetch applications for all jobs in parallel
  const appsPerJob = await Promise.all(
    jobs.map((job) =>
      adminDb.collection("applications").where("jobId", "==", job.id).get()
        .then((snap) => ({ job, apps: snap.docs.map((d) => d.data() as Application) }))
    )
  );

  let totalApproved = 0;
  let totalRejected = 0;
  let totalPending = 0;
  const jobBreakdown: JobDecisionCount[] = [];

  for (const { job, apps } of appsPerJob) {
    const approved = apps.filter((a) => a.decision === "approved").length;
    const rejected = apps.filter((a) => a.decision === "rejected").length;
    const pending = apps.filter((a) => !a.decision).length;
    totalApproved += approved;
    totalRejected += rejected;
    totalPending += pending;
    jobBreakdown.push({ jobId: job.id, jobTitle: job.title, positionId: job.positionId, approved, rejected, pending });
  }

  const totalDecisions = totalApproved + totalRejected;

  const orgStatus: OrgMLStatus = {
    model,
    isTrained: model !== null,
    totalDecisions,
    approvedCount: totalApproved,
    rejectedCount: totalRejected,
    pendingCount: totalPending,
    decisionsNeeded: Math.max(0, MIN_EXAMPLES - totalDecisions),
    jobCount: jobs.length,
    jobBreakdown: jobBreakdown.sort((a, b) => (b.approved + b.rejected) - (a.approved + a.rejected)),
  };

  return NextResponse.json({ status: orgStatus });
}
