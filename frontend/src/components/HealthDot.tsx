"use client";

import { useEffect, useState } from "react";
import { api, type Health } from "@/lib/api";

type State = { kind: "loading" } | { kind: "ok"; health: Health } | { kind: "down" };

export default function HealthDot() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      api
        .health()
        .then((health) => !cancelled && setState({ kind: "ok", health }))
        .catch(() => !cancelled && setState({ kind: "down" }));
    check();
    const id = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const [color, text] =
    state.kind === "loading"
      ? ["bg-slate-300", "Checking API"]
      : state.kind === "down"
        ? ["bg-rose-500", "API offline"]
        : state.health.model_loaded
          ? ["bg-emerald-500", "Model online"]
          : ["bg-amber-500", "Model not loaded"];

  return (
    <span
      className="ml-1 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
      title={state.kind === "ok" ? (state.health.model_error ?? `API v${state.health.version}`) : text}
    >
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {text}
    </span>
  );
}
