"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, Users, Clock, Plus, ChevronRight, Brain } from "lucide-react";
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50">
        <div className="h-44 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 animate-pulse" />
        <div className="max-w-5xl mx-auto px-6 -mt-8 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  const openJobs = jobs.filter((j) => j.status === "open");
  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.decision === "approved").length;

  const stats = [
    {
      label: "Open Positions",
      value: openJobs.length,
      icon: Briefcase,
      gradient: "from-blue-500 to-cyan-500",
      shadow: "shadow-blue-200",
      href: "/recruiter/jobs",
    },
    {
      label: "Total Applications",
      value: applications.length,
      icon: Users,
      gradient: "from-emerald-500 to-teal-500",
      shadow: "shadow-emerald-200",
      href: "/recruiter/applications",
    },
    {
      label: "Pending Review",
      value: pendingCount,
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
      shadow: "shadow-amber-200",
      href: "/recruiter/applications?status=pending",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50">

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 pt-10 pb-20">
        <div className="absolute -top-12 -right-12 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-56 h-56 bg-indigo-400/20 rounded-full blur-2xl" />
        <div className="absolute top-4 left-1/2 w-40 h-40 bg-violet-400/10 rounded-full blur-2xl" />

        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-blue-200 text-sm font-medium mb-1">Recruiter Portal 🎯</p>
              <h1 className="text-3xl font-bold text-white">Hiring Dashboard</h1>
              <p className="text-blue-200 text-sm mt-2">Manage roles, review candidates, and grow your team</p>
            </div>
            <Link
              href="/recruiter/jobs/new"
              className="flex-shrink-0 flex items-center gap-2 bg-white text-indigo-700 font-semibold text-sm px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <Plus size={16} />
              Post a Job
            </Link>
          </div>

          {/* Quick stat chips in hero */}
          {approvedCount > 0 && (
            <div className="flex flex-wrap gap-3 mt-6">
              <div className="flex items-center gap-1.5 bg-white/20 border border-white/20 text-white text-sm font-semibold px-3.5 py-1.5 rounded-full backdrop-blur-sm">
                <span className="text-emerald-300">✓</span>
                <span>{approvedCount} hired this cycle</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 -mt-10 pb-16 space-y-8">

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map(({ label, value, icon: Icon, gradient, shadow, href }) => (
            <Link key={label} href={href} className="block group">
              <div className={`bg-white rounded-2xl p-5 shadow-md ${shadow} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}>
                <div className="flex items-center gap-4">
                  <div className={`w-13 h-13 w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    <p className="text-sm text-gray-500">{label}</p>
                  </div>
                </div>
                <div className={`mt-3 h-1 w-0 group-hover:w-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-300`} />
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Job Postings */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Recent Job Postings</h2>
            <Link
              href="/recruiter/jobs"
              className="text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {openJobs.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 py-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Briefcase size={28} className="text-indigo-400" />
              </div>
              <p className="text-gray-600 font-medium mb-1">No open positions yet</p>
              <p className="text-gray-400 text-sm mb-4">Start hiring by creating your first role</p>
              <Link
                href="/recruiter/jobs/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-indigo-200 hover:scale-105 transition-all duration-200"
              >
                <Plus size={15} />
                Create Job Posting
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {openJobs.slice(0, 5).map((job, idx) => {
                const jobAppCount = applications.filter((a) => a.jobId === job.id).length;
                const pendingForJob = applications.filter((a) => a.jobId === job.id && a.status === "pending").length;
                const gradients = [
                  "from-blue-500 to-cyan-400",
                  "from-violet-500 to-purple-400",
                  "from-emerald-500 to-teal-400",
                  "from-rose-500 to-pink-400",
                  "from-amber-500 to-orange-400",
                ];
                const grad = gradients[idx % gradients.length];
                return (
                  <div
                    key={job.id}
                    className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Color indicator */}
                      <div className={`w-1.5 self-stretch rounded-full bg-gradient-to-b ${grad} flex-shrink-0`} />

                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Briefcase size={16} className="text-white" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{job.title}</p>
                        <p className="text-xs text-gray-400">
                          {job.positionId}{job.department ? ` · ${job.department}` : ""}
                        </p>
                      </div>

                      {/* Meta + actions */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {pendingForJob > 0 && (
                          <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                            {pendingForJob} pending
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{jobAppCount} applicant{jobAppCount !== 1 ? "s" : ""}</span>
                        <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                          Open
                        </span>
                        <Link
                          href={`/recruiter/jobs/${job.id}/edit`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick links row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Applications quick link */}
          <Link
            href="/recruiter/applications"
            className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 shadow-sm hover:shadow-md border border-gray-100 group transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                <Users size={18} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Review Applications</p>
                <p className="text-xs text-gray-400">
                  {pendingCount > 0 ? `${pendingCount} waiting for your decision` : "All caught up!"}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
          </Link>

          {/* ML model quick link */}
          <Link
            href="/recruiter/ml"
            className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md border border-indigo-100 group transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                <Brain size={18} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-indigo-900 text-sm">ML Hiring Model</p>
                <p className="text-xs text-indigo-500">View weights, status & how it learns</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-indigo-200 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
      </div>
    </div>
  );
}
