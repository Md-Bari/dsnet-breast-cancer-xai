"use client";

/* eslint-disable @next/next/no-img-element -- previews are blob URLs / backend images */
import { useCallback, useEffect, useRef, useState } from "react";
import ResultPanel from "@/components/ResultPanel";
import { api, ApiError, mediaUrl, type PredictionResult, type Sample } from "@/lib/api";

const MAX_MB = 10;
const ACCEPT = ["image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp"];

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.samples().then(setSamples).catch(() => setSamples([]));
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const analyze = useCallback(async (f: File) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.predict(f);
      setResult(r);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError ? e.message : "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const choose = (f: File | undefined, sampleName: string | null = null) => {
    if (!f) return;
    if (f.type && !ACCEPT.includes(f.type)) {
      setError(`Unsupported file type "${f.type}". Use PNG, JPEG, TIFF, BMP or WebP.`);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
    setActiveSample(sampleName);
    setPreview(URL.createObjectURL(f));
    return f;
  };

  const runSample = async (s: Sample) => {
    try {
      const blob = await fetch(mediaUrl(s.url)).then((r) => r.blob());
      const f = choose(new File([blob], s.name, { type: blob.type || "image/png" }), s.name);
      if (f) await analyze(f);
    } catch {
      setError("Could not load the sample image from the API.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Analyze a histopathology image</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Upload an H&amp;E-stained breast tissue image (BreakHis-style, any magnification). DS-Net returns
          benign / malignant probabilities and a Grad-CAM map of the regions that drove the decision.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files[0]);
            }}
            className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
              dragging
                ? "border-stain-500 bg-stain-50"
                : "border-slate-300 bg-white hover:border-stain-500 hover:bg-stain-50/40"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT.join(",")}
              className="hidden"
              onChange={(e) => choose(e.target.files?.[0])}
            />
            {preview ? (
              <img src={preview} alt="Selected" className="max-h-64 rounded-xl object-contain shadow" />
            ) : (
              <>
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-stain-100 text-stain-700">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                  </svg>
                </div>
                <p className="font-medium">Drop an image here or click to browse</p>
                <p className="mt-1 text-sm text-slate-500">PNG, JPEG, TIFF, BMP, WebP · up to {MAX_MB} MB</p>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              disabled={!file || loading}
              onClick={() => file && analyze(file)}
              className="inline-flex items-center gap-2 rounded-xl bg-stain-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-stain-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {loading ? "Analyzing…" : "Run analysis"}
            </button>
            {file && (
              <span className="truncate text-sm text-slate-500" title={file.name}>
                {file.name}
              </span>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Try a sample</h2>
          <p className="mb-4 text-sm text-slate-500">BreakHis images with known ground truth (400×)</p>
          {samples.length === 0 ? (
            <p className="text-sm text-slate-400">Samples load from the API when the backend is running.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {samples.map((s) => (
                <button
                  key={s.name}
                  onClick={() => runSample(s)}
                  disabled={loading}
                  title={`${s.ground_truth} · ${s.subtype}`}
                  className={`group relative overflow-hidden rounded-lg ring-2 transition disabled:opacity-60 ${
                    activeSample === s.name ? "ring-stain-500" : "ring-transparent hover:ring-stain-200"
                  }`}
                >
                  <img src={mediaUrl(s.url)} alt={s.subtype} className="aspect-square w-full object-cover" />
                  <span
                    className={`absolute inset-x-0 bottom-0 px-1 py-0.5 text-[10px] font-semibold text-white ${
                      s.ground_truth === "Benign" ? "bg-emerald-600/85" : "bg-rose-600/85"
                    }`}
                  >
                    {s.ground_truth}
                  </span>
                </button>
              ))}
            </div>
          )}
          {activeSample && (
            <p className="mt-3 text-xs text-slate-500">
              Ground truth:{" "}
              <b>
                {samples.find((s) => s.name === activeSample)?.ground_truth} ·{" "}
                {samples.find((s) => s.name === activeSample)?.subtype}
              </b>
            </p>
          )}
        </aside>
      </div>

      <div ref={resultRef} className="scroll-mt-24">
        {result && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-semibold">Result</h2>
            <ResultPanel result={result} />
          </section>
        )}
      </div>
    </div>
  );
}
