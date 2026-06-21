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

        const merged: JobWithApplication[] = jobs.map((job) => ({
          ...job,
          application: appByJobId.get(job.id) ?? null,
        }));

        // Sort: highest fit score first, then applied-but-scoring, then not yet applied
        merged.sort((a, b) => {
          const sa = a.application?.fitScore ?? -1;
          const sb = b.application?.fitScore ?? -1;
          return sb - sa;
        });

        setJobsWithApps(merged);
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
      // Reload to pick up the new application record
      await load();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setApplyingJobId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
        </div>
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
          Upload your resume to get matched with the best open roles and see your fit score.
        </p>
        <Link href="/candidate/upload"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
          Upload Resume
        </Link>
      </div>
    );
  }

  const bestMatch = jobsWithApps.find((j) => j.application && j.application.fitScore > 0);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Open Positions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {jobsWithApps.length} open role{jobsWithApps.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/candidate/upload" className="text-sm text-blue-600 hover:underline">
          Update Resume
        </Link>
      </div>

      {/* Error banner */}
      {applyError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {applyError}
        </div>
      )}

      {/* Best match highlight */}
      {bestMatch && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-600 text-white flex flex-col items-center justify-center">
            <span className="text-lg font-bold leading-none">{bestMatch.application!.fitScore}</span>
            <span className="text-[10px]">fit</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">Your Best Match</p>
            <p className="text-base font-semibold text-gray-900 truncate">{bestMatch.title}</p>
            <p className="text-xs text-gray-500">{bestMatch.positionId}</p>
          </div>
          {!bestMatch.application?.decision && (
            <button
              onClick={() => applyToJob(bestMatch.id)}
              disabled={applyingJobId === bestMatch.id || !!bestMatch.application}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {bestMatch.application ? "Applied" : "Apply"}
            </button>
          )}
        </div>
      )}

      {/* Job list */}
      {jobsWithApps.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No open roles at the moment. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobsWithApps.map((item) => (
            <JobCard
              key={item.id}
              item={item}
              hasResume={!!hasResume}
              applying={applyingJobId === item.id}
              onApply={() => applyToJob(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({
  item,
  hasResume,
  applying,
  onApply,
}: {
  item: JobWithApplication;
  hasResume: boolean;
  applying: boolean;
  onApply: () => void;
}) {
  const app = item.application;
  const score = app?.fitScore ?? null;
  const decision = app?.decision ?? null;
  const scored = score !== null && score > 0;

  const scoreColor = !scored
    ? "bg-gray-100 text-gray-400"
    : score >= 70
    ? "bg-emerald-100 text-emerald-700"
    : score >= 40
    ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Score badge */}
      <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${scoreColor}`}>
        {scored ? (
          <>
            <span className="text-xl font-bold leading-none">{score}</span>
            <span className="text-[10px] font-medium mt-0.5">fit</span>
          </>
        ) : app ? (
          <span className="text-[10px] font-medium text-center leading-tight px-1">Scoring…</span>
        ) : (
          <span className="text-lg text-gray-300">–</span>
        )}
      </div>

      {/* Job info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-gray-900 truncate">{item.title}</h2>
          <span className="text-xs text-gray-400 font-mono">{item.positionId}</span>
          {item.department && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {item.department}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {item.requiredSkills.slice(0, 4).map((s) => (
            <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{s}</span>
          ))}
          {item.requiredSkills.length > 4 && (
            <span className="text-xs text-gray-400">+{item.requiredSkills.length - 4} more</span>
          )}
        </div>
      </div>

      {/* Action / status */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {decision === "approved" && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Approved ✓
          </span>
        )}
        {decision === "rejected" && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
            Rejected
          </span>
        )}
        {!decision && !app && (
          hasResume ? (
            <button
              onClick={onApply}
              disabled={applying}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {applying ? "Applying…" : "Apply"}
            </button>
          ) : (
            <Link href="/candidate/upload"
              className="px-4 py-2 border border-blue-600 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap">
              Upload Resume
            </Link>
          )
        )}
        {!decision && app && (
          <span className="text-xs text-gray-400 mt-1">Under review</span>
        )}
      </div>
    </div>
  );
}
