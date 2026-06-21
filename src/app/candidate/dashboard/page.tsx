"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const token = await user!.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [resumeRes, jobsRes, appRes] = await Promise.all([
          fetch("/api/resumes/active", { headers }),
          fetch("/api/jobs/open", { headers }),
          fetch("/api/applications/mine", { headers }),
        ]);

        setHasResume(resumeRes.ok && (await resumeRes.json()).active === true);

        if (jobsRes.ok) {
          const { jobs }: { jobs: Job[] } = await jobsRes.json();
          const applications: Application[] = appRes.ok ? await appRes.json() : [];

          const appByJobId = new Map(applications.map((a) => [a.jobId, a]));

          const merged: JobWithApplication[] = jobs.map((job) => ({
            ...job,
            application: appByJobId.get(job.id) ?? null,
          }));

          // Sort: scored applications first (by fitScore desc), then unscored jobs
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
    }

    load();
  }, [user]);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasResume) {
    return (
      <div className="p-8 max-w-md mx-auto text-center mt-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to BestHire</h1>
        <p className="text-gray-500 mb-6">
          Upload your resume to see your fit score across all open roles.
        </p>
        <Link
          href="/candidate/upload"
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Upload Resume
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
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

      {jobsWithApps.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No open roles at the moment. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobsWithApps.map((item) => (
            <JobCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ item }: { item: JobWithApplication }) {
  const app = item.application;
  const score = app?.fitScore ?? null;
  const decision = app?.decision ?? null;

  const scoreColor =
    score === null
      ? "bg-gray-100 text-gray-400"
      : score >= 70
      ? "bg-emerald-100 text-emerald-700"
      : score >= 40
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";

  const decisionBadge =
    decision === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : decision === "rejected"
      ? "bg-red-100 text-red-700"
      : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Fit score badge */}
      <div
        className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-center ${scoreColor}`}
      >
        {score !== null ? (
          <>
            <span className="text-xl font-bold leading-none">{score}</span>
            <span className="text-[10px] font-medium mt-0.5">fit</span>
          </>
        ) : (
          <span className="text-xs font-medium">–</span>
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

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {item.requiredSkills.slice(0, 4).map((s) => (
            <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {s}
            </span>
          ))}
          {item.requiredSkills.length > 4 && (
            <span className="text-xs text-gray-400">+{item.requiredSkills.length - 4} more</span>
          )}
        </div>
      </div>

      {/* Decision / status */}
      <div className="flex-shrink-0 text-right">
        {decisionBadge ? (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${decisionBadge}`}>
            {decision === "approved" ? "Approved" : "Rejected"}
          </span>
        ) : score !== null ? (
          <span className="text-xs text-gray-400">Under review</span>
        ) : (
          <span className="text-xs text-gray-400">Scoring…</span>
        )}
      </div>
    </div>
  );
}
