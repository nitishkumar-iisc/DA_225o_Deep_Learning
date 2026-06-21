"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, Users, Clock, Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Application, Job } from "@/types";
import { OrgMLStatus } from "@/app/api/ml/status/route";

export default function RecruiterDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [mlStatus, setMlStatus] = useState<OrgMLStatus | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && (!user || role !== "recruiter")) router.push("/login");
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(async (token) => {
      const headers = { Authorization: `Bearer ${token}` };
      const [jobsRes, appsRes, mlRes] = await Promise.all([
        fetch("/api/jobs", { headers }),
        fetch("/api/applications", { headers }),
        fetch("/api/ml/status", { headers }),
      ]);
      const { jobs: jobList } = await jobsRes.json();
      const { applications: appList } = await appsRes.json();
      const mlJson = mlRes.ok ? await mlRes.json() : null;
      setJobs(jobList ?? []);
      setApplications(appList ?? []);
      setMlStatus(mlJson?.status ?? null);
    }).catch(() => {}).finally(() => setFetching(false));
  }, [user]);

  if (loading || fetching) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const openJobs = jobs.filter((j) => j.status === "open");
  const pendingCount = applications.filter((a) => a.status === "pending").length;

  const stats = [
    {
      label: "Open Positions",
      value: openJobs.length,
      icon: Briefcase,
      color: "bg-blue-50 text-blue-700",
      href: "/recruiter/jobs",
    },
    {
      label: "Total Applications",
      value: applications.length,
      icon: Users,
      color: "bg-green-50 text-green-700",
      href: "/recruiter/applications",
    },
    {
      label: "Pending Review",
      value: pendingCount,
      icon: Clock,
      color: "bg-amber-50 text-amber-700",
      href: "/recruiter/applications?status=pending",
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recruiter Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of your hiring activity</p>
        </div>
        <Link
          href="/recruiter/jobs/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Post a Job
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="block">
            <div className="bg-white border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={22} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Job Postings</h2>
          <Link href="/recruiter/jobs" className="text-sm text-blue-600 hover:underline">
            View all →
          </Link>
        </div>

        {openJobs.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
            <Briefcase size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-2">No open positions yet.</p>
            <Link
              href="/recruiter/jobs/new"
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              Create your first job posting →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {openJobs.slice(0, 5).map((job) => {
              const jobAppCount = applications.filter((a) => a.jobId === job.id).length;
              return (
                <div
                  key={job.id}
                  className="bg-white border rounded-xl p-4 flex items-center justify-between shadow-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900">{job.title}</p>
                    <p className="text-sm text-gray-400">
                      {job.positionId}{job.department ? ` · ${job.department}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{jobAppCount} applicant{jobAppCount !== 1 ? "s" : ""}</span>
                    <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                      Open
                    </span>
                    <Link
                      href={`/recruiter/jobs/${job.id}/edit`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Org-level ML Model Status ── */}
      <div className="mt-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">ML Hiring Model</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            One shared model learns from every approve/reject decision across all your roles. Needs 5 decisions to activate.
          </p>
        </div>

        {!mlStatus || mlStatus.jobCount === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Post a job and start reviewing applications to train your model.</p>
          </div>
        ) : (
          <OrgMLCard status={mlStatus} />
        )}
      </div>
    </div>
  );
}

const FEATURE_LABELS = [
  "Keyword Match",
  "Experience",
  "Education",
  "Skills Overlap",
  "Claude Score",
];

function OrgMLCard({ status: s }: { status: OrgMLStatus }) {
  const progress = Math.min(100, (s.totalDecisions / 5) * 100);

  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm ${s.isTrained ? "border-indigo-200" : "border-gray-200"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="font-semibold text-gray-900">Organisation Model</p>
          {s.isTrained && s.model && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last trained {new Date(s.model.trainedAt).toLocaleDateString()} · {s.model.sampleCount} decisions across {s.jobCount} role{s.jobCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <span className={`flex-shrink-0 text-xs font-bold px-3 py-1 rounded-full ${
          s.isTrained ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
        }`}>
          {s.isTrained ? "✓ Active" : "Not trained"}
        </span>
      </div>

      {/* Aggregate counters */}
      <div className="flex items-center gap-6 mb-4 text-sm">
        <span className="text-gray-500">
          <span className="font-semibold text-emerald-600">{s.approvedCount}</span> approved
        </span>
        <span className="text-gray-500">
          <span className="font-semibold text-red-500">{s.rejectedCount}</span> rejected
        </span>
        <span className="text-gray-500">
          <span className="font-semibold text-gray-700">{s.pendingCount}</span> pending
        </span>
      </div>

      {/* Progress bar (pre-training) */}
      {!s.isTrained && (
        <div className="mb-5">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{s.totalDecisions} / 5 decisions to activate model</span>
            <span>{s.decisionsNeeded} more needed</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Feature weights (trained only) */}
      {s.isTrained && s.model && (
        <div className="mb-5">
          <p className="text-xs font-medium text-gray-500 mb-2">Feature weights learned from your decisions</p>
          <div className="space-y-1.5">
            {s.model.weights.map((w, i) => {
              const maxW = Math.max(...s.model!.weights.map(Math.abs), 0.01);
              const pct = Math.round((Math.abs(w) / maxW) * 100);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-28 shrink-0">{FEATURE_LABELS[i]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${w >= 0 ? "bg-indigo-500" : "bg-rose-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right font-mono">{w.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
            <span>Overall approval rate: <span className="font-semibold text-gray-600">{Math.round(s.model.positiveRate * 100)}%</span></span>
            <span>Bias: <span className="font-mono">{s.model.bias.toFixed(3)}</span></span>
          </div>
        </div>
      )}

      {/* Per-job breakdown */}
      {s.jobBreakdown.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Decisions by role</p>
          <div className="divide-y divide-gray-100">
            {s.jobBreakdown.map((j) => (
              <div key={j.jobId} className="flex items-center justify-between py-2">
                <div className="min-w-0 mr-4">
                  <span className="text-sm text-gray-700 truncate block">{j.jobTitle}</span>
                  <span className="text-xs text-gray-400 font-mono">{j.positionId}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs">
                  <span className="text-emerald-600 font-semibold">+{j.approved}</span>
                  <span className="text-red-500 font-semibold">−{j.rejected}</span>
                  <span className="text-gray-400">{j.pending} pending</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
