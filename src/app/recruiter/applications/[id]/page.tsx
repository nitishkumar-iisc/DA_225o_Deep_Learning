"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, Info } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { FeatureBarChart } from "@/components/feature-bar-chart";
import { UndoCountdown } from "@/components/undo-countdown";
import { Application, Decision } from "@/types";

interface DetailData {
  application: Application;
  candidate: { name: string; email: string } | null;
  job: { title: string; positionId: string; department: string } | null;
  resumeUrl: string | null;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-green-100 text-green-800" : score >= 40 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`text-3xl font-bold px-4 py-2 rounded-xl ${color}`}>{score}</span>;
}

export default function ApplicationDetail() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();

  const [detail, setDetail] = useState<DetailData | null>(null);
  const [localApp, setLocalApp] = useState<Application | null>(null);
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
            <a
              href={resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <FileText size={14} />
              View Resume
            </a>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-gray-400">
              <FileText size={14} />
              Resume unavailable
            </span>
          )}
          <span className="text-gray-200">|</span>
          <span className="text-sm text-gray-500">
            Applied {new Date(localApp.createdAt).toLocaleDateString()}
          </span>
        </div>
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
                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {decisionLoading ? "Saving..." : "Approve"}
              </button>
              <button
                onClick={() => decide("rejected")}
                disabled={decisionLoading}
                className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {decisionLoading ? "Saving..." : "Reject"}
              </button>
            </>
          )}

          {!canDecide && (
            <div className="flex items-center gap-3">
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-lg ${
                  localApp.decision === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
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
