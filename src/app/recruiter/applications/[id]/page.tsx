"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, Info } from "lucide-react";
import { FeatureBarChart } from "@/components/feature-bar-chart";
import { UndoCountdown } from "@/components/undo-countdown";
import { Application, Job } from "@/types";

// Mock detail data — wired to real /api/applications/[id] after P2 merges phase-6-review-api
const MOCK_DETAIL: Record<
  string,
  { application: Application; candidateName: string; candidateEmail: string; job: Job; resumeUrl: string }
> = {
  app1: {
    candidateName: "Alice Chen",
    candidateEmail: "alice@candidate.dev",
    resumeUrl: "#",
    job: {
      id: "job1",
      positionId: "BH-2026-0001",
      title: "Senior Software Engineer",
      department: "Engineering",
      description: "Build scalable backend systems and contribute to platform architecture.",
      requiredSkills: ["TypeScript", "React", "Node.js"],
      requiredExperienceYears: 5,
      educationLevel: "bachelor",
      recruiterId: "r1",
      status: "open",
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
    },
    application: {
      id: "app1",
      candidateId: "c1",
      jobId: "job1",
      resumeId: "r1",
      fitScore: 84,
      featureVector: { keywordMatchScore: 0.9, experienceMatchScore: 1, educationScore: 0.8, skillsOverlapScore: 0.85, claudeRawScore: 0.82 },
      claudeReasoning: "Strong TypeScript and React experience with 6 years of full-stack work. Exceeds experience requirement. Education matches. Missing some DevOps skills but core competencies are strong.",
      status: "pending",
      decision: null,
      decidedAt: null,
      scheduledAt: null,
      calendarEventId: null,
      createdAt: "2026-06-10T09:00:00Z",
      updatedAt: "2026-06-10T09:00:00Z",
    },
  },
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-green-100 text-green-800" : score >= 40 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return (
    <span className={`text-3xl font-bold px-4 py-2 rounded-xl ${color}`}>{score}</span>
  );
}

export default function ApplicationDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const detail = MOCK_DETAIL[params.id];
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [localApp, setLocalApp] = useState<Application | null>(detail?.application ?? null);

  if (!detail || !localApp) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <p className="text-gray-500">Application not found.</p>
        <Link href="/recruiter/applications" className="text-blue-600 hover:underline text-sm mt-3 inline-block">
          ← Back to applications
        </Link>
      </div>
    );
  }

  const { candidateName, candidateEmail, resumeUrl, job } = detail;

  // TODO: wire to real PATCH /api/applications/[id]/decide after P2 merges phase-6-review-api
  async function decide(decision: "approved" | "rejected" | "undo") {
    setDecisionLoading(true);
    try {
      await new Promise((res) => setTimeout(res, 500)); // stub delay
      if (decision === "undo") {
        setLocalApp((a) => a && { ...a, status: "pending", decision: null, decidedAt: null });
      } else if (decision === "approved") {
        setLocalApp((a) => a && { ...a, status: "approved", decision: "approved", decidedAt: new Date().toISOString() });
      } else {
        setLocalApp((a) => a && { ...a, status: "rejected", decision: "rejected", decidedAt: new Date().toISOString() });
      }
    } finally {
      setDecisionLoading(false);
    }
  }

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
            <h1 className="text-xl font-bold text-gray-900">{candidateName}</h1>
            <p className="text-sm text-gray-500">{candidateEmail}</p>
            <p className="text-sm text-gray-400 mt-1">
              {job.title} · <span className="font-mono">{job.positionId}</span>
            </p>
          </div>
          <ScoreBadge score={localApp.fitScore} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href={resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <FileText size={14} />
            View Resume
          </a>
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

        {localApp.status === "interview_scheduled" && localApp.scheduledAt && (
          <p className="text-sm text-blue-700 mb-4">
            Interview scheduled for{" "}
            <span className="font-medium">
              {new Date(localApp.scheduledAt).toLocaleString()}
            </span>
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
                  localApp.decision === "approved"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
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
