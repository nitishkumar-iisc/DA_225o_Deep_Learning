"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { OrgMLStatus } from "@/app/api/ml/status/route";

const FEATURE_LABELS = [
  "Keyword Match",
  "Experience",
  "Education",
  "Skills Overlap",
  "Claude Score",
];

const FEATURE_DESCRIPTIONS = [
  "Fraction of required job keywords found in the candidate's resume",
  "Candidate's years of experience vs. what the role requires (clamped 0–1)",
  "How well the candidate's education level meets the job requirement",
  "Jaccard similarity between the candidate's skills and the role's required skills",
  "Claude's holistic 0–1 confidence that this candidate is a strong fit",
];

export default function MLModelPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<OrgMLStatus | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && (!user || role !== "recruiter")) router.push("/login");
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(async (token) => {
      const res = await fetch("/api/ml/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status ?? null);
      }
    }).catch(() => {}).finally(() => setFetching(false));
  }, [user]);

  if (loading || fetching) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ML Hiring Model</h1>
        <p className="text-gray-500 text-sm mt-1">
          One shared model learns from every hiring decision you make across all your roles.
        </p>
      </div>

      {/* ── How it works ── */}
      <section className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-indigo-900 mb-3">How it works</h2>
        <ol className="space-y-3 text-sm text-indigo-800">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
            <span>
              <strong>Candidate applies</strong> — BestHire computes 5 feature signals from the resume and the job description (see below), then runs them through the model to produce a <strong>fit score (0–100)</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
            <span>
              <strong>You decide</strong> — every time you approve or reject a candidate, that decision is used as a training label. <strong>Approve = 1, Reject = 0.</strong>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">3</span>
            <span>
              <strong>Model retrains automatically</strong> — after each decision, the model re-runs gradient descent over <em>all</em> your labelled applications (across all roles) and updates the feature weights.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">4</span>
            <span>
              <strong>Scores improve</strong> — the model learns which signals matter most to <em>your organisation</em>. If you consistently approve candidates with high experience scores, that weight grows. New applicants are rescored with the updated weights.
            </span>
          </li>
        </ol>
      </section>

      {/* ── Algorithm ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Under the hood — Logistic Regression</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Prediction formula</p>
            <p className="text-sm text-gray-700 font-mono bg-gray-50 rounded-lg px-3 py-2 mt-2">
              score = σ(w₁·f₁ + w₂·f₂ + … + w₅·f₅ + b)
            </p>
            <p className="text-xs text-gray-500 mt-2">
              σ is the sigmoid function (maps any value to 0–1). The result is multiplied by 100 to give the fit score.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Training</p>
            <p className="text-sm text-gray-600 mt-1">
              Gradient descent minimises binary cross-entropy loss over all labelled applications. Weights are updated after <strong>every recruiter decision</strong> and stored in Firestore.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Cold start</p>
            <p className="text-sm text-gray-600 mt-1">
              Before 5 decisions are made, the model uses <strong>equal default weights</strong> — every feature contributes equally to the score. The model activates once 5 decisions exist across your roles.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Org-level learning</p>
            <p className="text-sm text-gray-600 mt-1">
              One model is shared across <strong>all your job postings</strong>. A decision on any role adds signal for all future roles — the model learns your organisation's hiring preferences, not just role-specific ones.
            </p>
          </div>
        </div>
      </section>

      {/* ── Feature descriptions ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">The 5 features</h2>
        <div className="space-y-3">
          {FEATURE_LABELS.map((label, i) => (
            <div key={i} className="flex gap-4 bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                f{i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{FEATURE_DESCRIPTIONS[i]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live model status ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Current model status</h2>

        {!status || status.jobCount === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Post a job and start reviewing applications to train your model.</p>
          </div>
        ) : (
          <OrgMLCard status={status} />
        )}
      </section>
    </div>
  );
}

function OrgMLCard({ status: s }: { status: OrgMLStatus }) {
  const progress = Math.min(100, (s.totalDecisions / 5) * 100);

  return (
    <div className={`bg-white border rounded-2xl p-6 shadow-sm ${s.isTrained ? "border-indigo-200" : "border-gray-200"}`}>
      {/* Status badge + meta */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="font-semibold text-gray-900">Organisation Model</p>
          {s.isTrained && s.model ? (
            <p className="text-xs text-gray-400 mt-0.5">
              Last trained {new Date(s.model.trainedAt).toLocaleDateString()} · {s.model.sampleCount} decisions across {s.jobCount} role{s.jobCount !== 1 ? "s" : ""}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">Using equal default weights until 5 decisions are made</p>
          )}
        </div>
        <span className={`flex-shrink-0 text-xs font-bold px-3 py-1 rounded-full ${
          s.isTrained ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
        }`}>
          {s.isTrained ? "✓ Active" : "Not trained"}
        </span>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Approved", value: s.approvedCount, cls: "text-emerald-600" },
          { label: "Rejected", value: s.rejectedCount, cls: "text-red-500" },
          { label: "Pending review", value: s.pendingCount, cls: "text-gray-700" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${cls}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress (pre-training) */}
      {!s.isTrained && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>{s.totalDecisions} / 5 decisions to activate model</span>
            <span>{s.decisionsNeeded} more needed</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className="bg-indigo-500 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Feature weights */}
      {s.isTrained && s.model && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Learned feature weights</p>
          <div className="space-y-2.5">
            {s.model.weights.map((w, i) => {
              const maxW = Math.max(...s.model!.weights.map(Math.abs), 0.01);
              const pct = Math.round((Math.abs(w) / maxW) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-32 shrink-0">{FEATURE_LABELS[i]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${w >= 0 ? "bg-indigo-500" : "bg-rose-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right font-mono">{w.toFixed(3)}</span>
                  <span className={`text-xs font-medium w-16 text-right ${w >= 0 ? "text-indigo-600" : "text-rose-500"}`}>
                    {w >= 0 ? "+" : ""}
                    {w >= 0 ? "positive" : "negative"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
            <span>Overall approval rate: <span className="font-semibold text-gray-700">{Math.round(s.model.positiveRate * 100)}%</span></span>
            <span>Bias term: <span className="font-mono">{s.model.bias.toFixed(4)}</span></span>
          </div>
        </div>
      )}

      {/* Per-job breakdown */}
      {s.jobBreakdown.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Decisions by role</p>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {s.jobBreakdown.map((j, idx) => (
              <div key={j.jobId} className={`flex items-center justify-between px-4 py-3 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <div className="min-w-0 mr-4">
                  <span className="text-sm text-gray-800 font-medium truncate block">{j.jobTitle}</span>
                  <span className="text-xs text-gray-400 font-mono">{j.positionId}</span>
                </div>
                <div className="flex items-center gap-5 shrink-0 text-sm">
                  <span className="text-emerald-600 font-semibold">+{j.approved} approved</span>
                  <span className="text-red-500 font-semibold">−{j.rejected} rejected</span>
                  <span className="text-gray-400 text-xs">{j.pending} pending</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
