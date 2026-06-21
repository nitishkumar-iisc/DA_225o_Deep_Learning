"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, Users, Clock, Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Application, Job } from "@/types";

export default function RecruiterDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && (!user || role !== "recruiter")) router.push("/login");
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(async (token) => {
      const headers = { Authorization: `Bearer ${token}` };
      const [jobsRes, appsRes] = await Promise.all([
        fetch("/api/jobs", { headers }),
        fetch("/api/applications", { headers }),
      ]);
      const { jobs: jobList } = await jobsRes.json();
      const { applications: appList } = await appsRes.json();
      setJobs(jobList ?? []);
      setApplications(appList ?? []);
    }).catch(() => {}).finally(() => setFetching(false));
  }, [user]);

  if (loading || fetching) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const openJobs = jobs.filter((j) => j.status === "open");
  const pendingCount = applications.filter((a) => a.status === "pending").length;

  const stats = [
    {
      label: "Open Positions",
      value: openJobs.length,
      icon: Briefcase,
      color: "bg-blue-50 text-blue-700",
      href: "/recruiter/jobs",
    },
    {
      label: "Total Applications",
      value: applications.length,
      icon: Users,
      color: "bg-green-50 text-green-700",
      href: "/recruiter/applications",
    },
    {
      label: "Pending Review",
      value: pendingCount,
      icon: Clock,
      color: "bg-amber-50 text-amber-700",
      href: "/recruiter/applications?status=pending",
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recruiter Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of your hiring activity</p>
        </div>
        <Link
          href="/recruiter/jobs/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Post a Job
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="block">
            <div className="bg-white border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={22} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Job Postings</h2>
          <Link href="/recruiter/jobs" className="text-sm text-blue-600 hover:underline">
            View all →
          </Link>
        </div>

        {openJobs.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
            <Briefcase size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-2">No open positions yet.</p>
            <Link
              href="/recruiter/jobs/new"
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              Create your first job posting →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {openJobs.slice(0, 5).map((job) => {
              const jobAppCount = applications.filter((a) => a.jobId === job.id).length;
              return (
                <div
                  key={job.id}
                  className="bg-white border rounded-xl p-4 flex items-center justify-between shadow-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900">{job.title}</p>
                    <p className="text-sm text-gray-400">
                      {job.positionId}{job.department ? ` · ${job.department}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{jobAppCount} applicant{jobAppCount !== 1 ? "s" : ""}</span>
                    <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                      Open
                    </span>
                    <Link
                      href={`/recruiter/jobs/${job.id}/edit`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ML Model teaser ── */}
      <Link
        href="/recruiter/ml"
        className="mt-10 flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 hover:bg-indigo-100 transition-colors group"
      >
        <div>
          <p className="font-semibold text-indigo-900 text-sm">ML Hiring Model</p>
          <p className="text-xs text-indigo-600 mt-0.5">
            View model status, feature weights, and how the model learns from your decisions →
          </p>
        </div>
        <span className="text-indigo-400 group-hover:text-indigo-600 transition-colors text-lg">›</span>
      </Link>
    </div>
  );
}
