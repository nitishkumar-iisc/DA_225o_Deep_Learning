"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Application, Job } from "@/types";

interface JobWithApplication extends Job {
  application: Application | null;
}

export default function CandidateDashboard() {
  const { user } = useAuth();
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [jobsWithApps, setJobsWithApps] = useState<JobWithApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [resumeRes, jobsRes, appRes] = await Promise.all([
        fetch("/api/resumes/active", { headers }),
        fetch("/api/jobs/open", { headers }),
        fetch("/api/applications/mine", { headers }),
      ]);

      const resumeData = resumeRes.ok ? await resumeRes.json() : null;
      setHasResume(resumeData?.active === true);

      if (jobsRes.ok) {
        const { jobs }: { jobs: Job[] } = await jobsRes.json();
        const applications: Application[] = appRes.ok ? await appRes.json() : [];
        const appByJobId = new Map(applications.map((a) => [a.jobId, a]));

        setJobsWithApps(
          jobs.map((job) => ({ ...job, application: appByJobId.get(job.id) ?? null }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function applyToJob(jobId: string) {
    if (!user) return;
    setApplyingJobId(jobId);
    setApplyError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/applications/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to apply");
      }
      await load();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setApplyingJobId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!hasResume) {
    return (
      <div className="p-8 max-w-md mx-auto text-center mt-16">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to BestHire</h1>
        <p className="text-gray-500 mb-6">
          Upload your resume to get matched with open roles and see your fit score.
        </p>
        <Link href="/candidate/upload"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
          Upload Resume
        </Link>
      </div>
    );
  }

  const applied = jobsWithApps
    .filter((j) => j.application !== null)
    .sort((a, b) => (b.application!.fitScore ?? 0) - (a.application!.fitScore ?? 0));

  const open = jobsWithApps
    .filter((j) => j.application === null)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
        <Link href="/candidate/upload" className="text-sm text-blue-600 hover:underline">
          Update Resume
        </Link>
      </div>

      {applyError && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {applyError}
        </div>
      )}

      {/* ── Applied / Under Review ── */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-800">My Applications</h2>
          <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">
            {applied.length}
          </span>
        </div>

        {applied.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl py-10 text-center">
            <p className="text-gray-400 text-sm">You haven&apos;t applied to any positions yet.</p>
            <p className="text-gray-400 text-sm">Click <span className="font-medium">Apply</span> on any open position below.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applied.map((item) => (
              <AppliedCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* ── Open Positions ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-800">Open Positions</h2>
          <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">
            {open.length}
          </span>
        </div>

        {open.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl py-10 text-center">
            <p className="text-gray-400 text-sm">
              {applied.length > 0
                ? "You've applied to all open positions!"
                : "No open roles right now. Check back soon."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {open.map((item) => (
              <OpenJobCard
                key={item.id}
                item={item}
                applying={applyingJobId === item.id}
                onApply={() => applyToJob(item.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ── Applied card: shows fit score + status ── */
function AppliedCard({ item }: { item: JobWithApplication }) {
  const app = item.application!;
  const score = app.fitScore;
  const scored = score > 0;
  const decision = app.decision;

  const scoreColor = !scored
    ? "bg-gray-100 text-gray-400"
    : score >= 70
    ? "bg-emerald-100 text-emerald-700"
    : score >= 40
    ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";

  const statusLabel = decision === "approved"
    ? { label: "Approved", cls: "bg-emerald-100 text-emerald-700" }
    : decision === "rejected"
    ? { label: "Rejected", cls: "bg-red-100 text-red-700" }
    : scored
    ? { label: "Under Review", cls: "bg-blue-100 text-blue-700" }
    : { label: "Scoring…", cls: "bg-gray-100 text-gray-500" };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4 shadow-sm">
      {/* Score */}
      <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${scoreColor}`}>
        {scored ? (
          <>
            <span className="text-xl font-bold leading-none">{score}</span>
            <span className="text-[10px] font-medium mt-0.5">fit</span>
          </>
        ) : (
          <span className="text-[10px] font-medium text-center px-1 leading-tight">Scoring…</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-gray-900 truncate">{item.title}</h3>
          <span className="text-xs text-gray-400 font-mono">{item.positionId}</span>
          {item.department && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{item.department}</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{item.description}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {item.requiredSkills.slice(0, 4).map((s) => (
            <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{s}</span>
          ))}
          {item.requiredSkills.length > 4 && (
            <span className="text-xs text-gray-400">+{item.requiredSkills.length - 4} more</span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0">
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${statusLabel.cls}`}>
          {statusLabel.label}
        </span>
      </div>
    </div>
  );
}

/* ── Open job card: shows job info + Apply button ── */
function OpenJobCard({
  item,
  applying,
  onApply,
}: {
  item: JobWithApplication;
  applying: boolean;
  onApply: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Icon placeholder */}
      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center">
        <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-gray-900 truncate">{item.title}</h3>
          <span className="text-xs text-gray-400 font-mono">{item.positionId}</span>
          {item.department && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{item.department}</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {item.requiredSkills.slice(0, 4).map((s) => (
            <span key={s} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{s}</span>
          ))}
          {item.requiredSkills.length > 4 && (
            <span className="text-xs text-gray-400">+{item.requiredSkills.length - 4} more</span>
          )}
        </div>
      </div>

      {/* Apply button */}
      <div className="flex-shrink-0">
        <button
          onClick={onApply}
          disabled={applying}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {applying ? "Applying…" : "Apply Now"}
        </button>
      </div>
    </div>
  );
}
