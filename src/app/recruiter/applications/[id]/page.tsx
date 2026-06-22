"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, Info, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { FeatureBarChart } from "@/components/feature-bar-chart";
import { UndoCountdown } from "@/components/undo-countdown";
import { Application, Decision, FeatureVector } from "@/types";

interface DetailData {
  application: Application;
  candidate: { name: string; email: string } | null;
  job: { title: string; positionId: string; department: string } | null;
  resumeUrl: string | null;
}

interface AnalysisData {
  fitScore: number;
  featureVector: FeatureVector;
  claudeReasoning: string | null;
  skills: { matched: string[]; missing: string[]; extra: string[] };
  experience: { required: number; candidate: number; gap: number; status: "exceeds" | "meets" | "below" };
  education: { required: string; candidate: string; status: "exceeds" | "meets" | "below" };
  workHistory: { title: string; company: string; years: number }[];
  summary: string | null;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-green-100 text-green-800" : score >= 40 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`text-3xl font-bold px-4 py-2 rounded-xl ${color}`}>{score}</span>;
}

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="100" height="100" className="rotate-[-90deg]">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        className="transition-all duration-700"
      />
      <text x="50" y="56" textAnchor="middle" className="rotate-90" style={{ rotate: "90deg", transformOrigin: "50px 50px", fontSize: 20, fontWeight: 700, fill: color }}>
        {score}
      </text>
    </svg>
  );
}

function StatusPill({ status }: { status: "exceeds" | "meets" | "below" }) {
  const cfg = {
    exceeds: { label: "Exceeds", cls: "bg-emerald-100 text-emerald-700" },
    meets:   { label: "Meets",   cls: "bg-blue-100 text-blue-700" },
    below:   { label: "Below",   cls: "bg-red-100 text-red-600" },
  }[status];
  return <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

export default function ApplicationDetail() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();

  const [detail, setDetail] = useState<DetailData | null>(null);
  const [localApp, setLocalApp] = useState<Application | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(async (token) => {
      const res = await fetch(`/api/applications/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404 || res.status === 403) { setNotFound(true); return; }
      const data: DetailData = await res.json();
      setDetail(data);
      setLocalApp(data.application);
    }).catch(() => setNotFound(true)).finally(() => setFetching(false));
  }, [user, params.id]);

  const loadAnalysis = useCallback(async () => {
    if (!user) return;
    setAnalysisLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/applications/${params.id}/analysis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAnalysis(await res.json());
    } finally {
      setAnalysisLoading(false);
    }
  }, [user, params.id]);

  async function toggleAnalysis() {
    if (!analysisOpen && !analysis) await loadAnalysis();
    setAnalysisOpen((o) => !o);
  }

  async function rerun() {
    if (!user) return;
    setRerunning(true);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/applications/${params.id}/analysis`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadAnalysis();
      // Refresh the main application data too
      const res = await fetch(`/api/applications/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: DetailData = await res.json();
        setLocalApp(data.application);
      }
    } finally {
      setRerunning(false);
    }
  }

  async function decide(decision: Decision) {
    if (!user || !localApp) return;
    setDecisionLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/applications/${params.id}/decide`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Request failed");
        return;
      }
      const { decidedAt } = await res.json();
      if (decision === "undo") {
        setLocalApp((a) => a && { ...a, status: "pending", decision: null, decidedAt: null });
      } else {
        setLocalApp((a) =>
          a && { ...a, status: decision === "approved" ? "approved" : "rejected", decision, decidedAt }
        );
      }
    } finally {
      setDecisionLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (notFound || !detail || !localApp) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <p className="text-gray-500">Application not found or you don&apos;t have access.</p>
        <Link href="/recruiter/applications" className="text-blue-600 hover:underline text-sm mt-3 inline-block">
          ← Back to applications
        </Link>
      </div>
    );
  }

  const { candidate, job, resumeUrl } = detail;
  const canDecide = localApp.status === "pending";
  const canUndo = localApp.decidedAt !== null;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/recruiter/applications"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Back to applications
      </Link>

      {/* Header */}
      <div className="bg-white border rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{candidate?.name ?? "Unknown Candidate"}</h1>
            <p className="text-sm text-gray-500">{candidate?.email}</p>
            <p className="text-sm text-gray-400 mt-1">
              {job?.title} · <span className="font-mono">{job?.positionId}</span>
            </p>
          </div>
          <ScoreBadge score={localApp.fitScore} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {resumeUrl ? (
            <a href={resumeUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <FileText size={14} /> View Resume
            </a>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-gray-400">
              <FileText size={14} /> Resume unavailable
            </span>
          )}
          <span className="text-gray-200">|</span>
          <span className="text-sm text-gray-500">
            Applied {new Date(localApp.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* ── Fitment Analysis (collapsible) ── */}
      <div className="bg-white border rounded-xl shadow-sm mb-6 overflow-hidden">
        <button
          onClick={toggleAnalysis}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group"
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-900">Fitment Analysis</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
              Recruiter View
            </span>
          </div>
          <div className="flex items-center gap-2">
            {analysisLoading && (
              <RefreshCw size={14} className="text-indigo-500 animate-spin" />
            )}
            {analysisOpen
              ? <ChevronUp size={18} className="text-gray-400" />
              : <ChevronDown size={18} className="text-gray-400" />}
          </div>
        </button>

        {analysisOpen && (
          <div className="border-t border-gray-100 px-6 py-6 space-y-6">
            {analysisLoading && !analysis ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : analysis ? (
              <>
                {/* Score ring + summary */}
                <div className="flex items-center gap-6">
                  <ScoreRing score={analysis.fitScore} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Overall Fit Score</p>
                    <p className="text-xs text-gray-500">
                      {analysis.fitScore >= 70
                        ? "Strong match — candidate meets or exceeds most requirements."
                        : analysis.fitScore >= 40
                        ? "Partial match — some gaps but worth considering."
                        : "Weak match — significant gaps in required skills or experience."}
                    </p>
                    {analysis.summary && (
                      <p className="text-xs text-gray-400 mt-2 italic line-clamp-2">&ldquo;{analysis.summary}&rdquo;</p>
                    )}
                  </div>
                </div>

                {/* Skills breakdown */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Skills Breakdown</p>
                  <div className="space-y-3">
                    {analysis.skills.matched.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">
                          ✓ Matched <span className="font-semibold text-emerald-600">{analysis.skills.matched.length}</span> required skills
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.skills.matched.map((s) => (
                            <span key={s} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium">
                              ✓ {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.skills.missing.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">
                          ✗ Missing <span className="font-semibold text-red-500">{analysis.skills.missing.length}</span> required skills
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.skills.missing.map((s) => (
                            <span key={s} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-0.5 rounded-full font-medium">
                              ✗ {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.skills.extra.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">
                          + <span className="font-semibold text-gray-600">{analysis.skills.extra.length}</span> additional skills
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.skills.extra.slice(0, 8).map((s) => (
                            <span key={s} className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">
                              {s}
                            </span>
                          ))}
                          {analysis.skills.extra.length > 8 && (
                            <span className="text-xs text-gray-400">+{analysis.skills.extra.length - 8} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Experience & Education */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Experience</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">
                        <span className="font-bold text-gray-900">{analysis.experience.candidate}y</span> of {analysis.experience.required}y required
                      </span>
                      <StatusPill status={analysis.experience.status} />
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${analysis.experience.status === "below" ? "bg-red-400" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(100, (analysis.experience.candidate / Math.max(analysis.experience.required, 1)) * 100)}%` }}
                      />
                    </div>
                    {analysis.experience.gap > 0 && (
                      <p className="text-xs text-emerald-600 mt-1">+{analysis.experience.gap}y over requirement</p>
                    )}
                    {analysis.experience.gap < 0 && (
                      <p className="text-xs text-red-500 mt-1">{Math.abs(analysis.experience.gap)}y short</p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Education</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 capitalize">{analysis.education.candidate}</span>
                      <StatusPill status={analysis.education.status} />
                    </div>
                    <p className="text-xs text-gray-400">Required: <span className="capitalize font-medium">{analysis.education.required}</span></p>
                  </div>
                </div>

                {/* Work history */}
                {analysis.workHistory.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Work History</p>
                    <div className="space-y-2">
                      {analysis.workHistory.map((w, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{w.title}</p>
                            <p className="text-xs text-gray-400">{w.company}</p>
                          </div>
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {w.years}y
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feature vector bars */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">ML Feature Scores</p>
                  <FeatureBarChart features={analysis.featureVector} />
                </div>

                {/* Claude reasoning */}
                {analysis.claudeReasoning && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3">
                    <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-indigo-800 mb-1">Claude&apos;s Assessment</p>
                      <p className="text-sm text-indigo-700">{analysis.claudeReasoning}</p>
                    </div>
                  </div>
                )}

                {/* Re-run button */}
                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <button
                    onClick={rerun}
                    disabled={rerunning}
                    className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={rerunning ? "animate-spin" : ""} />
                    {rerunning ? "Re-running analysis…" : "Re-run scoring with current ML model"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Could not load analysis.</p>
            )}
          </div>
        )}
      </div>

      {/* Fit score breakdown */}
      <div className="bg-white border rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Fit Score Breakdown</h2>
        <FeatureBarChart features={localApp.featureVector} />
      </div>

      {/* Claude reasoning */}
      {localApp.claudeReasoning && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 flex gap-3">
          <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800 mb-1">Claude&apos;s Reasoning</p>
            <p className="text-sm text-blue-700">{localApp.claudeReasoning}</p>
          </div>
        </div>
      )}

      {/* Decision area */}
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Decision</h2>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        {localApp.status === "interview_scheduled" && localApp.scheduledAt && (
          <p className="text-sm text-blue-700 mb-4">
            Interview scheduled for{" "}
            <span className="font-medium">{new Date(localApp.scheduledAt).toLocaleString()}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {canDecide && (
            <>
              <button
                onClick={() => decide("approved")}
                disabled={decisionLoading}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {decisionLoading ? "Saving…" : "Approve"}
              </button>
              <button
                onClick={() => decide("rejected")}
                disabled={decisionLoading}
                className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {decisionLoading ? "Saving…" : "Reject"}
              </button>
            </>
          )}

          {!canDecide && (
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold px-3 py-1 rounded-lg ${
                localApp.decision === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}>
                {localApp.decision === "approved" ? "Approved" : "Rejected"}
              </span>
              {canUndo && localApp.decidedAt && (
                <UndoCountdown
                  decidedAt={localApp.decidedAt}
                  onUndo={() => decide("undo")}
                  loading={decisionLoading}
                />
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Decisions can be undone within 30 minutes. After that, they are locked.
        </p>
      </div>
    </div>
  );
}
