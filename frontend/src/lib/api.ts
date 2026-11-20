export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type Label = "Benign" | "Malignant" | "Inconclusive";

export interface PredictionResult {
  id: string;
  created_at: string;
  filename: string;
  label: Label;
  predicted_class: "Benign" | "Malignant";
  confidence: number;
  threshold: number;
  probabilities: { label: string; probability: number }[];
  inference_ms: number;
  image_size: [number, number];
  explanation: { original: string; heatmap: string; overlay: string };
}

export interface PredictionPage {
  items: PredictionResult[];
  total: number;
  limit: number;
  offset: number;
}

export interface HistoryStats {
  total: number;
  avg_confidence: number;
  avg_inference_ms: number;
  by_label: Partial<Record<Label, number>>;
}

export interface Sample {
  name: string;
  url: string;
  ground_truth: "Benign" | "Malignant";
  subtype: string;
  magnification: string;
}

export interface Health {
  status: "ok" | "degraded";
  model_loaded: boolean;
  model_error: string | null;
  version: string;
}

export interface FoldMetrics {
  fold: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number;
}

export interface ModelCard {
  name: string;
  full_name: string;
  task: string;
  framework: string;
  input_shape: number[];
  classes: string[];
  deployed_checkpoint: string;
  parameters: { total: number; trainable: number; non_trainable: number; size_mb: number };
  architecture: { stage: string; detail: string; output?: string }[];
  training: {
    dataset: string;
    validation: string;
    optimizer: string;
    loss: string;
    batch_size: number;
    epochs: number;
    callbacks: string[];
    augmentation: string[];
  };
  folds: FoldMetrics[];
  summary: {
    accuracy_mean: number;
    accuracy_std: number;
    precision_mean: number;
    recall_mean: number;
    f1_mean: number;
    auc_mean: number;
  };
  deployed_confusion_matrix: { labels: string[]; matrix: number[][]; note: string };
  limitations: string[];
  confidence_threshold: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(`Cannot reach the API at ${API_URL}. Is the backend running?`, 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const mediaUrl = (path: string) => `${API_URL}${path}`;

export const api = {
  health: () => request<Health>("/api/v1/health"),
  model: () => request<ModelCard>("/api/v1/model"),
  samples: () => request<Sample[]>("/api/v1/samples"),
  predict: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<PredictionResult>("/api/v1/predict", { method: "POST", body });
  },
  predictions: (params: { limit?: number; offset?: number; label?: Label }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
    return request<PredictionPage>(`/api/v1/predictions?${q}`);
  },
  prediction: (id: string) => request<PredictionResult>(`/api/v1/predictions/${encodeURIComponent(id)}`),
  stats: () => request<HistoryStats>("/api/v1/predictions/stats"),
  deletePrediction: (id: string) =>
    request<void>(`/api/v1/predictions/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
