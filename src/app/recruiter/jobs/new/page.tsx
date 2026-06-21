"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { JobForm, JobFormValues } from "@/components/job-form";

export default function NewJobPage() {
  const { user } = useAuth();
  const router = useRouter();

  async function handleSubmit(values: JobFormValues) {
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to create job");
    }
    router.push("/recruiter/jobs");
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
        <h1 className="text-2xl font-bold text-gray-900">Post a New Job</h1>
        <p className="text-gray-500 text-sm mt-1">
          A unique Position ID will be generated automatically.
        </p>
      </div>

      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <JobForm onSubmit={handleSubmit} submitLabel="Create Job Posting" />
      </div>
    </div>
  );
}
