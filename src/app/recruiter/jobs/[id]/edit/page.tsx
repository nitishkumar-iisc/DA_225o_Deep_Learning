"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { JobForm, JobFormValues } from "@/components/job-form";
import { Job } from "@/types";

export default function EditJobPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(async (token) => {
      const res = await fetch("/api/jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { jobs } = await res.json();
      const found = (jobs as Job[]).find((j) => j.id === params.id);
      if (!found) setNotFound(true);
      else setJob(found);
    });
  }, [user, params.id]);

  async function handleSubmit(values: JobFormValues) {
    if (!user || !job) throw new Error("Not ready");
    const token = await user.getIdToken();
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to update job");
    }
    router.push("/recruiter/jobs");
  }

  if (notFound) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <p className="text-gray-500">Job not found or you don&apos;t have access.</p>
        <Link href="/recruiter/jobs" className="text-blue-600 hover:underline text-sm mt-3 inline-block">
          ← Back to jobs
        </Link>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link
        href="/recruiter/jobs"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Back to jobs
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Edit Job Posting</h1>
        <p className="text-sm text-gray-400 mt-1">
          Position ID: <span className="font-mono font-medium text-gray-600">{job.positionId}</span>
          {" "}(immutable)
        </p>
      </div>

      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <JobForm
          initialValues={job}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          showStatusField
        />
      </div>
    </div>
  );
}
