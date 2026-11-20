import { mediaUrl, pct, type PredictionResult } from "@/lib/api";
import GradCamViewer from "./GradCamViewer";
import LabelBadge, { labelStyles } from "./LabelBadge";

export default function ResultPanel({ result }: { result: PredictionResult }) {
  const style = labelStyles[result.label];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-4">
        <div className={`rounded-2xl border p-5 ${style.panel}`}>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Prediction</p>
          <div className="mt-2 flex items-center gap-3">
            <LabelBadge label={result.label} size="lg" />
            <span className="font-mono text-2xl font-semibold">{pct(result.confidence, 2)}</span>
          </div>
          {result.label === "Inconclusive" && (
            <p className="mt-3 text-sm text-amber-800">
              Top class was <b>{result.predicted_class}</b>, but confidence is below the{" "}
              {pct(result.threshold, 0)} threshold. This image may be out of distribution (not an H&amp;E
              breast histopathology patch) or genuinely ambiguous.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold">Class probabilities</h3>
          <div className="space-y-4">
            {result.probabilities.map((p) => (
              <div key={p.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{p.label}</span>
                  <span className="font-mono text-slate-600">{pct(p.probability, 2)}</span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      p.label === "Malignant" ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${p.probability * 100}%` }}
                  />
                  <div
                    className="absolute top-0 h-full w-px bg-slate-400"
                    style={{ left: `${result.threshold * 100}%` }}
                    title={`Decision threshold ${pct(result.threshold, 0)}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Vertical tick = {pct(result.threshold, 0)} confidence threshold
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["File", result.filename],
            ["Resolution", `${result.image_size[0]} × ${result.image_size[1]} px`],
            ["Inference + Grad-CAM", `${result.inference_ms.toFixed(0)} ms`],
            ["Analyzed", new Date(result.created_at).toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="truncate font-medium" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>

        <a
          href={mediaUrl(result.explanation.overlay)}
          download={`gradcam_${result.id}.png`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-stain-700 hover:underline"
        >
          Download Grad-CAM overlay ↓
        </a>
      </div>

      <GradCamViewer result={result} />
    </div>
  );
}
