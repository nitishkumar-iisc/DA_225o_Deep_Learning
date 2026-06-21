"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Application, Job } from "@/types";
import { ApplicationCard } from "@/components/application-card";

interface ApplicationWithJob extends Application {
  job: Pick<Job, "title" | "positionId">;
}

export default function CandidateDashboard() {
  const { user } = useAuth();
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const token = await user!.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [resumeRes, appRes] = await Promise.all([
          fetch("/api/resumes/active", { headers }),
          fetch("/api/applications/mine", { headers }),
        ]);

        setHasResume(resumeRes.ok && (await resumeRes.json()).active === true);

        if (appRes.ok) {
          const data: ApplicationWithJob[] = await appRes.json();
          data.sort((a, b) => b.fitScore - a.fitScore);
          setApplications(data);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasResume) {
    return (
      <div className="p-8 max-w-md mx-auto text-center mt-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to BestHire</h1>
        <p className="text-gray-500 mb-6">Upload your resume to see your fit score across all open roles.</p>
        <Link href="/candidate/upload" className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Upload Resume
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
        <Link href="/candidate/upload" className="text-sm text-blue-600 hover:underline">
          Update Resume
        </Link>
      </div>

      {applications.length === 0 ? (
        <p className="text-gray-500">No open roles available yet. Check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => (
            <ApplicationCard key={app.id} application={app} />
          ))}
        </div>
      )}
    </div>
  );
}
