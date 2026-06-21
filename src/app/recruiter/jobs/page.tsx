"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Job, JobStatus } from "@/types";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<string, string> = {
    open: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-600",
    closed: "bg-yellow-100 text-yellow-700",
    deleted: "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", styles[status])}>
      {status}
    </span>
  );
}

export default function RecruiterJobs() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || role !== "recruiter")) {
      router.push("/login");
    }
  }, [user, role, loading, router]);

  async function loadJobs() {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/jobs", { headers: { Authorization: `Bearer ${token}` } });
    const { jobs } = await res.json();
    setJobs(jobs ?? []);
  }

  useEffect(() => {
    if (!user) return;
    loadJobs().finally(() => setFetching(false));
  }, [user]);

  async function patchJob(id: string, patch: Partial<Job>) {
    if (!user) return;
    setActionLoading(id);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await loadJobs();
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteJob(id: string) {
    if (!confirm("Delete this job posting? Applications will be retained.")) return;
    if (!user) return;
    setActionLoading(id);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/jobs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadJobs();
    } finally {
      setActionLoading(null);
    }
  }

  if (loading || fetching) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
          <p className="text-gray-500 text-sm mt-1">{jobs.length} posting{jobs.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/recruiter/jobs/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500 mb-2">No job postings yet.</p>
          <Link
            href="/recruiter/jobs/new"
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            Create your first posting →
          </Link>
        </div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Applications</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{job.title}</p>
                    <p className="text-xs text-gray-400">{job.positionId}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{job.department || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">—</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/recruiter/jobs/${job.id}/edit`}
                        className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </Link>
                      {job.status === "open" && (
                        <button
                          onClick={() => patchJob(job.id, { status: "closed" })}
                          disabled={actionLoading === job.id}
                          className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-40"
                          title="Close"
                        >
                          <XCircle size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteJob(job.id)}
                        disabled={actionLoading === job.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
