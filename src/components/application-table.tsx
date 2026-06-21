"use client";

import Link from "next/link";
import { Application, Job } from "@/types";
import { cn } from "@/lib/utils";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-100 text-green-800"
      : score >= 40
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800";
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", color)}>
      {score}
    </span>
  );
}

function StatusPill({ status }: { status: Application["status"] }) {
  const styles: Record<Application["status"], string> = {
    pending: "bg-gray-100 text-gray-600",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    interview_scheduled: "bg-blue-100 text-blue-700",
  };
  const labels: Record<Application["status"], string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    interview_scheduled: "Scheduled",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", styles[status])}>
      {labels[status]}
    </span>
  );
}

interface Row {
  application: Application;
  candidateName: string;
  job: Job;
}

interface Props {
  rows: Row[];
}

export function ApplicationTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">No applications match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-3">Candidate</th>
            <th className="px-4 py-3">Position</th>
            <th className="px-4 py-3 text-center">Score</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3">Applied</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ application, candidateName, job }) => (
            <tr key={application.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{candidateName}</td>
              <td className="px-4 py-3">
                <div className="text-gray-900">{job.title}</div>
                <div className="text-xs text-gray-400">{job.positionId}</div>
              </td>
              <td className="px-4 py-3 text-center">
                <ScoreBadge score={application.fitScore} />
              </td>
              <td className="px-4 py-3 text-center">
                <StatusPill status={application.status} />
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(application.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/recruiter/applications/${application.id}`}
                  className="text-blue-600 hover:underline text-xs font-medium"
                >
                  Review →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
