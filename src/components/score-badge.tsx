interface ScoreBadgeProps {
  score: number;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className={`${color} text-white text-sm font-bold px-2.5 py-1 rounded-full`}>
      {score}
    </span>
  );
}
