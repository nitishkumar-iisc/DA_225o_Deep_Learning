"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApplicationTable } from "@/components/application-table";
import { Application, Job } from "@/types";

type StatusFilter = "all" | Application["status"];

interface ApplicationRow {
  application: Application;
  candidateName: string;
  job: Job;
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-0">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-5 bg-gray-200 rounded-full w-10" />
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="h-4 bg-gray-200 rounded w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export default function RecruiterApplications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const token = await user!.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [appsRes, jobsRes] = await Promise.all([
          fetch("/api/applications", { headers }),
          fetch("/api/jobs", { headers }),
        ]);

        if (jobsRes.ok) {
          const { jobs: recruiterJobs } = await jobsRes.json() as { jobs: Job[] };
          setJobs(recruiterJobs ?? []);
        }

        if (appsRes.ok) {
          const data = await appsRes.json() as ApplicationRow[];
          setRows(data ?? []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  const filtered = rows
    .filter(({ application, job }) => {
      if (jobFilter !== "all" && job.id !== jobFilter) return false;
      if (statusFilter !== "all" && application.status !== statusFilter) return false;
      if (application.fitScore < minScore || application.fitScore > maxScore) return false;
      return true;
    })
    .sort((a, b) => b.application.fitScore - a.application.fitScore);

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
            {jobs.map((j) => (
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
              type="range" min={0} max={100} value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-24"
            />
            <input
              type="range" min={0} max={100} value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value))}
              className="w-24"
            />
          </div>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => { setJobFilter("all"); setStatusFilter("all"); setMinScore(0); setMaxScore(100); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <>
            <div className="px-4 py-3 border-b bg-gray-50">
              <div className="h-3 bg-gray-200 rounded w-20 animate-pulse" />
            </div>
            <TableSkeleton />
          </>
        ) : (
          <>
            <div className="px-4 py-3 border-b bg-gray-50 text-xs text-gray-500">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </div>
            <ApplicationTable rows={filtered} />
          </>
        )}
      </div>
    </div>
  );
}
