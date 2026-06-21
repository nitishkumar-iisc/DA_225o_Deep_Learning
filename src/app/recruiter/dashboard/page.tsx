"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, Users, Clock, Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Application, Job } from "@/types";
import { JobMLStatus } from "@/app/api/ml/status/route";

export default function RecruiterDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [mlModels, setMlModels] = useState<JobMLStatus[]>([]);
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
      const { models } = mlRes.ok ? await mlRes.json() : { models: [] };
      setJobs(jobList ?? []);
      setApplications(appList ?? []);
      setMlModels(models ?? []);
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

      {/* ── ML Model Status ── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">ML Model Status</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Models improve as you approve / reject candidates. Needs 5 decisions to activate.
            </p>
          </div>
        </div>

        {mlModels.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">No jobs yet — post a job to start training.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mlModels.map((m) => (
              <MLModelCard key={m.jobId} model={m} />
            ))}
          </div>
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

function MLModelCard({ model: m }: { model: JobMLStatus }) {
  const progress = Math.min(100, (m.totalDecisions / 5) * 100);

  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm ${m.isTrained ? "border-indigo-200" : "border-gray-200"}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{m.jobTitle}</span>
            <span className="text-xs text-gray-400 font-mono">{m.positionId}</span>
          </div>
          {m.isTrained && m.model && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last trained {new Date(m.model.trainedAt).toLocaleDateString()} · {m.model.sampleCount} samples
            </p>
          )}
        </div>

        <span className={`flex-shrink-0 text-xs font-bold px-3 py-1 rounded-full ${
          m.isTrained
            ? "bg-indigo-100 text-indigo-700"
            : "bg-gray-100 text-gray-500"
        }`}>
          {m.isTrained ? "✓ Active" : "Not trained"}
        </span>
      </div>

      {/* Decision counters */}
      <div className="flex items-center gap-6 mb-3 text-sm">
        <span className="text-gray-500">
          <span className="font-semibold text-emerald-600">{m.approvedCount}</span> approved
        </span>
        <span className="text-gray-500">
          <span className="font-semibold text-red-500">{m.rejectedCount}</span> rejected
        </span>
        <span className="text-gray-500">
          <span className="font-semibold text-gray-700">{m.pendingCount}</span> pending review
        </span>
      </div>

      {/* Progress toward first training */}
      {!m.isTrained && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{m.totalDecisions} / 5 decisions to activate model</span>
            <span>{m.decisionsNeeded} more needed</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Feature weights (only when trained) */}
      {m.isTrained && m.model && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Feature weights</p>
          <div className="space-y-1.5">
            {m.model.weights.map((w, i) => {
              const maxW = Math.max(...m.model!.weights.map(Math.abs), 0.01);
              const pct = Math.round((Math.abs(w) / maxW) * 100);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-28 truncate">{FEATURE_LABELS[i]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${w >= 0 ? "bg-indigo-500" : "bg-rose-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">{w.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              Approval rate: <span className="font-semibold text-gray-600">{Math.round(m.model.positiveRate * 100)}%</span>
            </span>
            <span className="text-xs text-gray-400">
              Bias: <span className="font-mono">{m.model.bias.toFixed(3)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
