import { Suspense } from "react";
import PredictionDetail from "./PredictionDetail";

export default function PredictionDetailPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl animate-pulse px-4 py-10 text-slate-400">Loading…</p>}>
      <PredictionDetail />
    </Suspense>
  );
}
