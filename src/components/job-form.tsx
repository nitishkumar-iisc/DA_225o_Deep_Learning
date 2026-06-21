"use client";

import { useState } from "react";
import { JobEducationLevel, JobStatus } from "@/types";
import { SkillTagInput } from "@/components/skill-tag-input";

export interface JobFormValues {
  title: string;
  department: string;
  description: string;
  requiredSkills: string[];
  requiredExperienceYears: number;
  educationLevel: JobEducationLevel;
  status?: JobStatus;
}

interface Props {
  initialValues?: Partial<JobFormValues>;
  onSubmit: (values: JobFormValues) => Promise<void>;
  submitLabel?: string;
  showStatusField?: boolean;
}

export function JobForm({
  initialValues = {},
  onSubmit,
  submitLabel = "Save",
  showStatusField = false,
}: Props) {
  const [values, setValues] = useState<JobFormValues>({
    title: initialValues.title ?? "",
    department: initialValues.department ?? "",
    description: initialValues.description ?? "",
    requiredSkills: initialValues.requiredSkills ?? [],
    requiredExperienceYears: initialValues.requiredExperienceYears ?? 0,
    educationLevel: initialValues.educationLevel ?? "any",
    status: initialValues.status,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof JobFormValues>(key: K, val: JobFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit(values);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Title <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. Senior Software Engineer"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department
          </label>
          <input
            value={values.department}
            onChange={(e) => set("department", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. Engineering"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={6}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          placeholder="Describe the role, responsibilities, and what success looks like..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Required Skills
        </label>
        <SkillTagInput
          value={values.requiredSkills}
          onChange={(tags) => set("requiredSkills", tags)}
          placeholder="Type a skill and press Enter or comma..."
        />
        <p className="text-xs text-gray-400 mt-1">
          Press Enter or comma to add a skill, Backspace to remove the last one
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min. Experience (years)
          </label>
          <input
            type="number"
            min={0}
            max={30}
            value={values.requiredExperienceYears}
            onChange={(e) => set("requiredExperienceYears", Number(e.target.value))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Education Level
          </label>
          <select
            value={values.educationLevel}
            onChange={(e) => set("educationLevel", e.target.value as JobEducationLevel)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="any">Any</option>
            <option value="bachelor">Bachelor&apos;s</option>
            <option value="master">Master&apos;s</option>
            <option value="phd">PhD</option>
          </select>
        </div>
      </div>

      {showStatusField && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={values.status ?? "open"}
            onChange={(e) => set("status", e.target.value as JobStatus)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="open">Open</option>
            <option value="draft">Draft</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
