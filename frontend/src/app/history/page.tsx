"use client";

/* eslint-disable @next/next/no-img-element -- thumbnails are served by the backend */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import LabelBadge from "@/components/LabelBadge";
import { api, ApiError, mediaUrl, pct, type HistoryStats, type Label, type PredictionPage } from "@/lib/api";

const PAGE_SIZE = 12;
const FILTERS: (Label | "All")[] = ["All", "Benign", "Malignant", "Inconclusive"];

export default function HistoryPage() {
  const [filter, setFilter] = useState<Label | "All">("All");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<PredictionPage | null>(null);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.predictions({ limit: PAGE_SIZE, offset, label: filter === "All" ? undefined : filter }),
      api.stats(),
    ])
      .then(([p, s]) => {
        if (cancelled) return;
        setPage(p);
        setStats(s);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Failed to load history."));
    return () => {
      cancelled = true;
    };
  }, [filter, offset, reloadKey]);

  const remove = async (id: string) => {
    if (!confirm("Delete this prediction and its images?")) return;
    try {
      await api.deletePrediction(id);
      if (page && page.items.length === 1 && offset > 0) setOffset(offset - PAGE_SIZE);
      else reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prediction history</h1>
          <p className="mt-1 text-slate-600">Every analysis is stored with its Grad-CAM artefacts.</p>
        </div>
        <Link
          href="/analyze"
          className="rounded-xl bg-stain-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stain-700"
        >
          New analysis
        </Link>
      </header>

      {stats && (
        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Total", String(stats.total)],
            ["Benign", String(stats.by_label.Benign ?? 0)],
            ["Malignant", String(stats.by_label.Malignant ?? 0)],
            ["Avg confidence", stats.total ? pct(stats.avg_confidence) : "–"],
            ["Avg latency", stats.total ? `${stats.avg_inference_ms.toFixed(0)} ms` : "–"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">{k}</p>
              <p className="mt-1 font-mono text-xl font-semibold">{v}</p>
            </div>
          ))}
        </section>
      )}

      <div className="mb-5 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setOffset(0);
            }}
            className={`rounded-md px-3 py-1.5 font-medium ${
              filter === f ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>}

      {page && page.items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          No predictions yet.{" "}
          <Link href="/analyze" className="font-medium text-stain-700 hover:underline">
            Analyze an image
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {page?.items.map((p) => (
          <article
            key={p.id}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <Link href={`/history/${p.id}`} className="block">
              <div className="relative aspect-[3/2] overflow-hidden bg-slate-100">
                <img
                  src={mediaUrl(p.explanation.overlay)}
                  alt={p.filename}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="space-y-1 p-4">
                <div className="flex items-center justify-between gap-2">
                  <LabelBadge label={p.label} />
                  <span className="font-mono text-sm">{pct(p.confidence, 2)}</span>
                </div>
                <p className="truncate text-sm font-medium" title={p.filename}>
                  {p.filename}
                </p>
                <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</p>
              </div>
            </Link>
            <div className="flex justify-end border-t border-slate-100 px-4 py-2">
              <button onClick={() => remove(p.id)} className="text-xs font-medium text-slate-400 hover:text-rose-600">
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      {page && page.total > PAGE_SIZE && (
        <nav className="mt-8 flex items-center justify-center gap-3 text-sm">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-slate-500">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, page.total)} of {page.total}
          </span>
          <button
            disabled={offset + PAGE_SIZE >= page.total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 disabled:opacity-40"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
