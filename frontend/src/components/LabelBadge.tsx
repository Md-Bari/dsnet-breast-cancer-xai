import type { Label } from "@/lib/api";

export const labelStyles: Record<Label, { badge: string; bar: string; panel: string; dot: string }> = {
  Benign: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    bar: "bg-emerald-500",
    panel: "border-emerald-200 bg-emerald-50/60",
    dot: "bg-emerald-500",
  },
  Malignant: {
    badge: "bg-rose-50 text-rose-700 ring-rose-600/20",
    bar: "bg-rose-500",
    panel: "border-rose-200 bg-rose-50/60",
    dot: "bg-rose-500",
  },
  Inconclusive: {
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    bar: "bg-amber-500",
    panel: "border-amber-200 bg-amber-50/60",
    dot: "bg-amber-500",
  },
};

export default function LabelBadge({ label, size = "sm" }: { label: Label; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${labelStyles[label].badge} ${
        size === "lg" ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${labelStyles[label].dot}`} />
      {label}
    </span>
  );
}
