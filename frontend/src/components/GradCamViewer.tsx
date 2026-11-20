"use client";

/* eslint-disable @next/next/no-img-element -- images are served by the FastAPI backend at runtime */
import { useState } from "react";
import { mediaUrl, type PredictionResult } from "@/lib/api";

type Mode = "blend" | "split";

export default function GradCamViewer({ result }: { result: PredictionResult }) {
  const [mode, setMode] = useState<Mode>("blend");
  const [opacity, setOpacity] = useState(50);
  const { original, heatmap, overlay } = result.explanation;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Grad-CAM explanation</h3>
          <p className="text-xs text-slate-500">
            Regions that most increased the <b>{result.predicted_class}</b> score
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
          {(["blend", "split"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {m === "blend" ? "Overlay" : "Side by side"}
            </button>
          ))}
        </div>
      </div>

      {mode === "blend" ? (
        <>
          <div className="relative overflow-hidden rounded-xl bg-slate-900">
            <img src={mediaUrl(original)} alt="Original histopathology image" className="block w-full" />
            <img
              src={mediaUrl(heatmap)}
              alt="Grad-CAM heatmap"
              className="absolute inset-0 h-full w-full mix-blend-normal transition-opacity"
              style={{ opacity: opacity / 100 }}
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="w-16 text-xs text-slate-500">Heatmap</span>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="flex-1"
              aria-label="Heatmap opacity"
            />
            <span className="w-10 text-right font-mono text-xs text-slate-600">{opacity}%</span>
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <figure>
            <img src={mediaUrl(original)} alt="Original" className="w-full rounded-xl" />
            <figcaption className="mt-1 text-center text-xs text-slate-500">Original</figcaption>
          </figure>
          <figure>
            <img src={mediaUrl(overlay)} alt="Grad-CAM overlay" className="w-full rounded-xl" />
            <figcaption className="mt-1 text-center text-xs text-slate-500">Grad-CAM overlay</figcaption>
          </figure>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
        <span>Low</span>
        <span className="h-2 flex-1 rounded-full bg-gradient-to-r from-[#00008f] via-[#00ffff] via-50% to-[#800000]" />
        <span>High attribution</span>
      </div>
    </div>
  );
}
