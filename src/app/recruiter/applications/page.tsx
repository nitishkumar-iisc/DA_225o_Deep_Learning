"use client";

import { useState } from "react";
import { ApplicationTable } from "@/components/application-table";
import { Application, Job } from "@/types";

// Mock data — wired to real /api/applications after P2 merges phase-6-review-api
const MOCK_JOBS: Job[] = [
  {
    id: "job1",
    positionId: "BH-2026-0001",
    title: "Senior Software Engineer",
    department: "Engineering",
    description: "",
    requiredSkills: ["TypeScript", "React", "Node.js"],
    requiredExperienceYears: 5,
    educationLevel: "bachelor",
    recruiterId: "r1",
    status: "open",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "job2",
    positionId: "BH-2026-0002",
    title: "ML Engineer",
    department: "AI",
    description: "",
    requiredSkills: ["Python", "TensorFlow", "PyTorch"],
    requiredExperienceYears: 3,
    educationLevel: "master",
    recruiterId: "r1",
    status: "open",
    createdAt: "2026-06-02T00:00:00Z",
    updatedAt: "2026-06-02T00:00:00Z",
  },
];

const MOCK_ROWS: { application: Application; candidateName: string; job: Job }[] = [
  {
    candidateName: "Alice Chen",
    job: MOCK_JOBS[0],
    application: {
      id: "app1",
      candidateId: "c1",
      jobId: "job1",
      resumeId: "r1",
      fitScore: 84,
      featureVector: { keywordMatchScore: 0.9, experienceMatchScore: 1, educationScore: 0.8, skillsOverlapScore: 0.85, claudeRawScore: 0.82 },
      claudeReasoning: "Strong TypeScript and React experience. Exceeds experience requirement.",
      status: "pending",
      decision: null,
      decidedAt: null,
      scheduledAt: null,
      calendarEventId: null,
      createdAt: "2026-06-10T09:00:00Z",
      updatedAt: "2026-06-10T09:00:00Z",
    },
  },
  {
    candidateName: "Bob Patel",
    job: MOCK_JOBS[1],
    application: {
      id: "app2",
      candidateId: "c2",
      jobId: "job2",
      resumeId: "r2",
      fitScore: 61,
      featureVector: { keywordMatchScore: 0.65, experienceMatchScore: 0.8, educationScore: 1, skillsOverlapScore: 0.6, claudeRawScore: 0.58 },
      claudeReasoning: "Good ML background. Missing PyTorch experience.",
      status: "approved",
      decision: "approved",
      decidedAt: "2026-06-12T14:00:00Z",
      scheduledAt: "2026-06-15T10:00:00Z",
      calendarEventId: "evt123",
      createdAt: "2026-06-11T10:00:00Z",
      updatedAt: "2026-06-12T14:00:00Z",
    },
  },
  {
    candidateName: "Carol Smith",
    job: MOCK_JOBS[0],
    application: {
      id: "app3",
      candidateId: "c3",
      jobId: "job1",
      resumeId: "r3",
      fitScore: 38,
      featureVector: { keywordMatchScore: 0.4, experienceMatchScore: 0.5, educationScore: 0.6, skillsOverlapScore: 0.3, claudeRawScore: 0.35 },
      claudeReasoning: "Junior-level experience; skill set only partially matches requirements.",
      status: "rejected",
      decision: "rejected",
      decidedAt: "2026-06-13T11:00:00Z",
      scheduledAt: null,
      calendarEventId: null,
      createdAt: "2026-06-11T11:00:00Z",
      updatedAt: "2026-06-13T11:00:00Z",
    },
  },
];

type StatusFilter = "all" | Application["status"];

export default function RecruiterApplications() {
  const [jobFilter, setJobFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);

  const filtered = MOCK_ROWS.filter(({ application, job }) => {
    if (jobFilter !== "all" && job.id !== jobFilter) return false;
    if (statusFilter !== "all" && application.status !== statusFilter) return false;
    if (application.fitScore < minScore || application.fitScore > maxScore) return false;
    return true;
  }).sort((a, b) => b.application.fitScore - a.application.fitScore);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="text-gray-500 text-sm mt-1">
          Review and act on candidate applications across all your job postings.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 mb-6 flex flex-wrap gap-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Job</label>
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All jobs</option>
            {MOCK_JOBS.map((j) => (
              <option key={j.id} value={j.id}>
                {j.positionId} — {j.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="interview_scheduled">Scheduled</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Score range: {minScore}–{maxScore}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-24"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value))}
              className="w-24"
            />
          </div>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => {
              setJobFilter("all");
              setStatusFilter("all");
              setMinScore(0);
              setMaxScore(100);
            }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 text-xs text-gray-500">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </div>
        <ApplicationTable rows={filtered} />
      </div>
    </div>
  );
}
