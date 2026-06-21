import { Application, Job } from "@/types";
import { ScoreBadge } from "@/components/score-badge";

interface ApplicationCardProps {
  application: Application & { job: Pick<Job, "title" | "positionId"> };
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  interview_scheduled: "Interview Scheduled",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  interview_scheduled: "bg-blue-100 text-blue-700",
};

export function ApplicationCard({ application: app }: ApplicationCardProps) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 text-sm leading-tight">{app.job.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{app.job.positionId}</p>
        </div>
        <ScoreBadge score={app.fitScore} />
      </div>

      <span className={`self-start text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[app.status] ?? "bg-gray-100 text-gray-700"}`}>
        {STATUS_LABELS[app.status] ?? app.status}
      </span>

      {app.status === "interview_scheduled" && app.scheduledAt && (
        <p className="text-xs text-blue-600">
          📅 {new Date(app.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}
    </div>
  );
}
