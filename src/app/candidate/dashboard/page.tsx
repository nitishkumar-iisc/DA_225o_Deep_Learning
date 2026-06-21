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
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">
        <div className="h-44 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-600 animate-pulse" />
        <div className="max-w-4xl mx-auto px-6 -mt-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl animate-pulse shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasResume) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to BestHire!</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Upload your resume to get AI-powered fit scores against open roles and find your perfect match.
          </p>
          <Link
            href="/candidate/upload"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:scale-105 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Resume
          </Link>
        </div>
      </div>
    );
  }

  const applied = jobsWithApps
    .filter((j) => j.application !== null)
    .sort((a, b) => (b.application!.fitScore ?? 0) - (a.application!.fitScore ?? 0));

  const open = jobsWithApps
    .filter((j) => j.application === null)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  const recommended = applied.filter((j) => (j.application?.fitScore ?? 0) >= 60).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-6 pt-10 pb-20">
        {/* decorative blobs */}
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl" />

        <div className="relative max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-200 text-sm font-medium mb-1">Welcome back 👋</p>
              <h1 className="text-3xl font-bold text-white">Your Career Hub</h1>
              <p className="text-violet-200 text-sm mt-2">Track applications and discover new opportunities</p>
            </div>
            <Link
              href="/candidate/upload"
              className="hidden sm:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2.5 rounded-xl backdrop-blur-sm border border-white/20 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Update Resume
            </Link>
          </div>

          {/* Stat chips */}
          <div className="flex flex-wrap gap-3 mt-8">
            <StatChip value={applied.length} label="Applied" color="bg-white/20 text-white border-white/20" />
            <StatChip value={open.length} label="Open Roles" color="bg-cyan-400/20 text-cyan-100 border-cyan-300/30" />
            {recommended > 0 && (
              <StatChip value={recommended} label="Recommended" color="bg-amber-400/20 text-amber-100 border-amber-300/30" icon="★" />
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 -mt-10 pb-16 space-y-8">

        {applyError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl shadow-sm">
            {applyError}
          </div>
        )}

        {/* My Applications */}
        <section>
          <SectionHeader
            title="My Applications"
            count={applied.length}
            countColor="bg-purple-100 text-purple-700"
          />

          {applied.length === 0 ? (
            <EmptyState
              icon="📋"
              message="No applications yet"
              sub="Click Apply on any open role below to get started"
            />
          ) : (
            <div className="space-y-3">
              {applied.map((item) => (
                <AppliedCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        {/* Open Positions */}
        <section>
          <SectionHeader
            title="Open Positions"
            count={open.length}
            countColor="bg-cyan-100 text-cyan-700"
          />

          {open.length === 0 ? (
            <EmptyState
              icon="🎉"
              message={applied.length > 0 ? "You've applied to all open positions!" : "No open roles right now"}
              sub={applied.length > 0 ? "Check back soon for new opportunities" : "New roles are posted regularly — check back soon"}
            />
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
    </div>
  );
}

/* ── Small helpers ── */

function StatChip({ value, label, color, icon }: { value: number; label: string; color: string; icon?: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-sm font-semibold backdrop-blur-sm ${color}`}>
      {icon && <span>{icon}</span>}
      <span>{value}</span>
      <span className="font-normal opacity-80">{label}</span>
    </div>
  );
}

function SectionHeader({ title, count, countColor }: { title: string; count: number; countColor: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${countColor}`}>{count}</span>
    </div>
  );
}

function EmptyState({ icon, message, sub }: { icon: string; message: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-semibold text-gray-700">{message}</p>
      <p className="text-sm text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

/* ── Status config ── */
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  scoring: { label: "Scoring…",    bg: "bg-gray-100",    text: "text-gray-500",   dot: "bg-gray-300" },
  review:  { label: "Under Review", bg: "bg-blue-100",    text: "text-blue-700",   dot: "bg-blue-400" },
  approved:{ label: "Approved",     bg: "bg-emerald-100", text: "text-emerald-700",dot: "bg-emerald-500" },
  rejected:{ label: "Rejected",     bg: "bg-red-100",     text: "text-red-600",    dot: "bg-red-400" },
};

/* ── Applied card ── */
function AppliedCard({ item }: { item: JobWithApplication }) {
  const app = item.application!;
  const score = app.fitScore;
  const scored = score > 0;
  const recommended = scored && score >= 60;

  const statusKey = app.decision === "approved" ? "approved"
    : app.decision === "rejected" ? "rejected"
    : scored ? "review" : "scoring";
  const st = STATUS_CONFIG[statusKey];

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-l-4 overflow-hidden hover:shadow-md transition-shadow ${
      recommended ? "border-l-amber-400" : statusKey === "approved" ? "border-l-emerald-400" : statusKey === "rejected" ? "border-l-red-300" : "border-l-blue-300"
    }`}>
      <div className="flex items-start gap-4 p-5">
        {/* Icon */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
          recommended ? "bg-amber-50" : "bg-indigo-50"
        }`}>
          {recommended ? "⭐" : "💼"}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-gray-900">{item.title}</h3>
            {recommended && (
              <span className="text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-400 text-white px-2.5 py-0.5 rounded-full">
                ★ Recommended
              </span>
            )}
            <span className="text-xs text-gray-400 font-mono">{item.positionId}</span>
          </div>

          {item.department && (
            <p className="text-xs text-gray-400 mb-2">{item.department}</p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {item.requiredSkills.slice(0, 4).map((s) => (
              <span key={s} className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
            {item.requiredSkills.length > 4 && (
              <span className="text-xs text-gray-400">+{item.requiredSkills.length - 4}</span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${st.bg} ${st.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </div>
      </div>
    </div>
  );
}

/* ── Open job card ── */
function OpenJobCard({ item, applying, onApply }: { item: JobWithApplication; applying: boolean; onApply: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-4 p-5">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white shadow-sm">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-gray-900">{item.title}</h3>
            <span className="text-xs text-gray-400 font-mono">{item.positionId}</span>
            {item.department && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{item.department}</span>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-2 line-clamp-1">{item.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {item.requiredSkills.slice(0, 4).map((s) => (
              <span key={s} className="text-xs bg-cyan-50 text-cyan-700 border border-cyan-100 px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
            {item.requiredSkills.length > 4 && (
              <span className="text-xs text-gray-400">+{item.requiredSkills.length - 4}</span>
            )}
          </div>
        </div>

        {/* Apply button */}
        <button
          onClick={onApply}
          disabled={applying}
          className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-indigo-200 hover:shadow-md disabled:opacity-50 transition-all duration-200 hover:scale-105 active:scale-100"
        >
          {applying ? "Applying…" : "Apply Now"}
        </button>
      </div>

      {/* Bottom accent bar */}
      <div className="h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-300" />
    </div>
  );
}
