"use client";

import { useEffect, useState } from "react";
import { api, ApiError, pct, type ModelCard } from "@/lib/api";

const METRICS = ["accuracy", "precision", "recall", "f1", "auc"] as const;
const METRIC_LABEL: Record<(typeof METRICS)[number], string> = {
  accuracy: "Accuracy",
  precision: "Precision",
  recall: "Recall",
  f1: "F1",
  auc: "ROC AUC",
};

export default function ModelPage() {
  const [card, setCard] = useState<ModelCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<(typeof METRICS)[number]>("accuracy");

  useEffect(() => {
    api
      .model()
      .then(setCard)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load model card."));
  }, []);

  if (error)
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
      </div>
    );
  if (!card)
    return <div className="mx-auto max-w-6xl animate-pulse px-4 py-16 text-slate-400">Loading model card…</div>;

  const values = card.folds.map((f) => f[metric]);
  const lo = Math.floor(Math.min(...values) * 100 - 1) / 100;
  const hi = 1;
  const cm = card.deployed_confusion_matrix;
  const cmTotal = cm.matrix.flat().reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <header>
        <p className="text-sm font-medium text-stain-700">Model card</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{card.full_name}</h1>
        <p className="mt-2 max-w-3xl text-slate-600">{card.task}.</p>
      </header>

      {/* headline numbers */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Mean accuracy", pct(card.summary.accuracy_mean, 2), `± ${pct(card.summary.accuracy_std, 2)}`],
          ["Mean ROC AUC", card.summary.auc_mean.toFixed(4), "5 folds"],
          ["Mean F1", pct(card.summary.f1_mean, 2), "malignant"],
          ["Parameters", `${(card.parameters.total / 1e6).toFixed(2)}M`, `${card.parameters.size_mb} MB`],
          ["Input", card.input_shape.join(" × "), "RGB"],
        ].map(([k, v, sub]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{v}</p>
            <p className="text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </section>

      {/* per-fold chart + confusion matrix */}
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">5-fold cross-validation</h2>
            <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1 text-xs">
              {METRICS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    metric === m ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {METRIC_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex h-56 items-end gap-4 border-b border-l border-slate-200 pl-2">
            {card.folds.map((f) => {
              const v = f[metric];
              const h = ((v - lo) / (hi - lo)) * 100;
              const deployed = f.fold === 5;
              return (
                <div key={f.fold} className="flex h-full flex-1 flex-col items-center justify-end">
                  <span className="mb-1 font-mono text-xs text-slate-600">
                    {metric === "auc" ? v.toFixed(4) : pct(v, 2)}
                  </span>
                  <div
                    className={`w-full max-w-16 rounded-t-md transition-all duration-500 ${
                      deployed ? "bg-stain-600" : "bg-stain-200"
                    }`}
                    style={{ height: `${Math.max(h, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-4 pl-2">
            {card.folds.map((f) => (
              <span key={f.fold} className="flex-1 text-center text-xs text-slate-500">
                Fold {f.fold}
                {f.fold === 5 && <span className="block text-stain-700">deployed</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Y-axis starts at {pct(lo, 0)} to make fold differences visible.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Confusion matrix (deployed model)</h2>
          <p className="mb-4 text-xs text-slate-500">{cm.note}</p>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-sm">
            <span />
            {cm.labels.map((l) => (
              <span key={l} className="text-center text-xs font-medium text-slate-500">
                Pred. {l}
              </span>
            ))}
            {cm.matrix.map((row, i) => (
              <div key={i} className="contents">
                <span className="self-center pr-1 text-right text-xs font-medium text-slate-500">
                  True {cm.labels[i]}
                </span>
                {row.map((v, j) => {
                  const correct = i === j;
                  return (
                    <div
                      key={j}
                      className={`rounded-xl px-2 py-5 text-center ${
                        correct ? "bg-stain-600 text-white" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      <div className="font-mono text-2xl font-semibold">{v}</div>
                      <div className="text-[11px] opacity-80">{pct(v / cmTotal, 1)}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* fold table */}
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Fold</th>
              {METRICS.map((m) => (
                <th key={m} className="px-4 py-3 text-right">
                  {METRIC_LABEL[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {card.folds.map((f) => (
              <tr key={f.fold} className={f.fold === 5 ? "bg-stain-50/60" : ""}>
                <td className="px-4 py-2.5 font-sans">
                  {f.fold}
                  {f.fold === 5 && <span className="ml-2 text-xs text-stain-700">deployed</span>}
                </td>
                {METRICS.map((m) => (
                  <td key={m} className="px-4 py-2.5 text-right">
                    {m === "auc" ? f[m].toFixed(4) : pct(f[m], 2)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="px-4 py-2.5 font-sans">Mean</td>
              <td className="px-4 py-2.5 text-right">{pct(card.summary.accuracy_mean, 2)}</td>
              <td className="px-4 py-2.5 text-right">{pct(card.summary.precision_mean, 2)}</td>
              <td className="px-4 py-2.5 text-right">{pct(card.summary.recall_mean, 2)}</td>
              <td className="px-4 py-2.5 text-right">{pct(card.summary.f1_mean, 2)}</td>
              <td className="px-4 py-2.5 text-right">{card.summary.auc_mean.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* architecture */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">Architecture</h2>
          <ol className="relative space-y-2">
            {card.architecture.map((s, i) => {
              const special = s.stage.includes("Attention") || s.stage.includes("Residual");
              return (
                <li key={s.stage} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                        special ? "bg-pink-500 text-white" : "bg-stain-100 text-stain-700"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {i < card.architecture.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                  </div>
                  <div className={`mb-1 flex-1 rounded-xl px-3 py-2 ${special ? "bg-pink-50" : "bg-slate-50"}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{s.stage}</span>
                      {s.output && <span className="font-mono text-xs text-slate-500">{s.output}</span>}
                    </div>
                    <p className="text-xs text-slate-600">{s.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Training setup</h2>
            <dl className="space-y-2 text-sm">
              {[
                ["Data", card.training.dataset],
                ["Validation", card.training.validation],
                ["Optimizer", card.training.optimizer],
                ["Loss", card.training.loss],
                ["Batch / epochs", `${card.training.batch_size} / ${card.training.epochs}`],
                ["Callbacks", card.training.callbacks.join(", ")],
                ["Augmentation", card.training.augmentation.join(", ")],
                ["Checkpoint", card.deployed_checkpoint],
                ["Inconclusive below", pct(card.confidence_threshold, 0)],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="mb-2 font-semibold text-amber-900">Limitations</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-amber-900/90">
              {card.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
