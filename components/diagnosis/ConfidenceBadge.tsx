type ConfidenceBadgeProps = {
  confidence: number;
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const percent = Math.round(confidence * 100);
  const tone =
    percent >= 80
      ? "border-teal-200 bg-teal-50 text-teal-800"
      : percent >= 60
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {percent}% confidence
    </span>
  );
}
