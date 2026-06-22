"use client";

import { FeatureVector } from "@/types";

const FEATURES: { key: keyof FeatureVector; label: string }[] = [
  { key: "keywordMatchScore", label: "Keyword Match" },
  { key: "experienceMatchScore", label: "Experience" },
  { key: "educationScore", label: "Education" },
  { key: "skillsOverlapScore", label: "Skills Overlap" },
  { key: "claudeRawScore", label: "Claude Score" },
];

function barColor(score: number) {
  if (score >= 0.7) return "bg-green-500";
  if (score >= 0.4) return "bg-amber-400";
  return "bg-red-400";
}

interface Props {
  features: FeatureVector;
}

export function FeatureBarChart({ features }: Props) {
  return (
    <div className="space-y-3">
      {FEATURES.map(({ key, label }) => {
        const score = features[key];
        const pct = Math.round(score * 100);
        return (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">{label}</span>
              <span className="font-medium text-gray-900">{pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(score)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
