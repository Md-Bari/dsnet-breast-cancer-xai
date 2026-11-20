import Image from "next/image";
import Link from "next/link";

const stats = [
  { value: "98.98%", label: "Mean accuracy", sub: "5-fold stratified CV" },
  { value: "0.9994", label: "Mean ROC AUC", sub: "2,000 test images / fold" },
  { value: "1.31M", label: "Parameters", sub: "5 MB checkpoint" },
  { value: "99.35%", label: "Deployed model", sub: "fold 5 test accuracy" },
];

const steps = [
  {
    title: "Upload",
    body: "Drop an H&E breast histopathology image. The API validates type and size, then resizes it to 224 × 224.",
  },
  {
    title: "Classify",
    body: "DS-Net, a residual CNN with a trunk-and-mask attention module, outputs benign / malignant probabilities. Low-confidence results are flagged Inconclusive.",
  },
  {
    title: "Explain",
    body: "Grad-CAM, computed in closed form from the classifier head, highlights the tissue regions behind the decision.",
  },
];

const stack = [
  ["Model", "Keras 3 · TensorFlow · custom residual-attention CNN"],
  ["Explainability", "Grad-CAM (exact, autodiff-free) · OpenCV"],
  ["Backend", "FastAPI · Pydantic v2 · SQLite · pytest"],
  ["Frontend", "Next.js (App Router) · React · TypeScript · Tailwind CSS"],
  ["Ops", "Docker · docker compose · health checks · OpenAPI docs"],
];

export default function Home() {
  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-stain-200 to-pink-200 opacity-50 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-stain-50 px-3 py-1 text-xs font-medium text-stain-700 ring-1 ring-stain-200">
              Explainable AI · Digital pathology
            </span>
            <h1 className="mt-5 text-4xl leading-tight font-bold tracking-tight md:text-5xl">
              Breast cancer histopathology classification you can{" "}
              <span className="bg-gradient-to-r from-stain-600 to-pink-500 bg-clip-text text-transparent">see into</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              DS-Net is a lightweight residual-attention CNN that separates benign from malignant breast tissue and
              shows <em>why</em> with Grad-CAM heatmaps, served through a FastAPI backend and a Next.js interface.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/analyze"
                className="rounded-xl bg-stain-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-stain-700"
              >
                Analyze an image →
              </Link>
              <Link
                href="/model"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                View model card
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <Image
                src="/showcase/malignant.png"
                alt="Ductal carcinoma, 400x"
                width={460}
                height={460}
                className="aspect-square rounded-xl object-cover"
                priority
              />
              <figcaption className="px-1 pt-2 text-xs text-slate-500">Input · ductal carcinoma (400×)</figcaption>
            </figure>
            <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <Image
                src="/showcase/malignant-gradcam.png"
                alt="Grad-CAM overlay"
                width={224}
                height={224}
                className="aspect-square rounded-xl object-cover"
                priority
              />
              <figcaption className="flex items-center justify-between px-1 pt-2 text-xs text-slate-500">
                Grad-CAM
                <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">Malignant</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* stats */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="font-mono text-3xl font-semibold text-stain-700">{s.value}</p>
              <p className="mt-1 font-medium">{s.label}</p>
              <p className="text-xs text-slate-500">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="mb-6 text-2xl font-bold tracking-tight">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-stain-100 font-mono font-semibold text-stain-700">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* stack */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-5 text-2xl font-bold tracking-tight">System architecture</h2>
          <div className="mb-6 flex flex-wrap items-center gap-2 font-mono text-xs">
            {["Next.js UI", "REST / JSON", "FastAPI", "DS-Net + Grad-CAM", "SQLite + PNG store"].map((n, i, a) => (
              <span key={n} className="flex items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">{n}</span>
                {i < a.length - 1 && <span className="text-slate-400">→</span>}
              </span>
            ))}
          </div>
          <dl className="divide-y divide-slate-100">
            {stack.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
                <dt className="font-medium">{k}</dt>
                <dd className="text-slate-600">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
