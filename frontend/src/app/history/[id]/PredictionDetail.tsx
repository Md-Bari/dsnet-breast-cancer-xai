"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ResultPanel from "@/components/ResultPanel";
import { api, ApiError, type PredictionResult } from "@/lib/api";

export default function PredictionDetail() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .prediction(id)
      .then(setResult)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load prediction."));
  }, [id]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/history" className="text-sm font-medium text-stain-700 hover:underline">
        ← Back to history
      </Link>
      <h1 className="mt-3 mb-6 text-2xl font-bold tracking-tight">
        Prediction <span className="font-mono text-slate-400">#{id}</span>
      </h1>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>}
      {!result && !error && <p className="animate-pulse text-slate-400">Loading…</p>}
      {result && <ResultPanel result={result} />}
    </div>
  );
}
