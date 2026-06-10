// ---------------------------------------------------------------------------
// API client — talks to the FastAPI backend (Render deployment)
// All requests use the env var NEXT_PUBLIC_API_URL as the base.
// ---------------------------------------------------------------------------

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://emnist-digit-recogniser-27.onrender.com";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DigitPrediction {
  digit: number;      // 0–9
  confidence: number; // 0–1
}

export interface PredictResponse {
  predictions:       DigitPrediction[]; // top-5, descending confidence
  top_digit:         number;
  top_confidence:    number;
  inference_time_ms: number;
  model_version:     string;
}

export interface HealthResponse {
  status:       "ok" | "degraded";
  model_loaded: boolean;
  version:      string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.detail ?? detail;
    } catch { /* ignore parse errors */ }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Submit a base64-encoded PNG (280×280, white bg, dark stroke) for
 * digit classification. Returns top-5 predictions with confidence scores.
 */
export async function predictDigit(base64Png: string): Promise<PredictResponse> {
  return post<PredictResponse>("/api/predict", { image: base64Png });
}

/**
 * Lightweight health probe — used on page load to show the API status badge.
 */
export async function healthCheck(): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/health`, {
    // Short timeout: we'd rather show "unknown" than block render
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
