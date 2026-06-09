# app/models.py
# Pydantic schemas for /predict request and response.
# These must match the TypeScript types in frontend/lib/api.ts exactly.

from pydantic import BaseModel, Field, field_validator
import base64


# ── Request ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """
    POST /predict body.
    `image` is a raw base64-encoded PNG string — no data-URL prefix.
    The frontend CanvasDraw component always produces 280×280 white-background PNGs.
    """
    image: str = Field(..., description="Base64-encoded PNG (no data-URL prefix)")

    @field_validator("image")
    @classmethod
    def validate_base64(cls, v: str) -> str:
        # Strip accidental data-URL prefix if the client sends one
        if v.startswith("data:"):
            v = v.split(",", 1)[-1]
        # Validate it's actually base64
        try:
            decoded = base64.b64decode(v, validate=True)
        except Exception:
            raise ValueError("image must be valid base64-encoded data")
        # Sanity-check minimum size (even 1×1 PNG is ~67 bytes)
        if len(decoded) < 64:
            raise ValueError("image payload too small — likely empty or corrupt")
        return v


# ── Response ──────────────────────────────────────────────────────────────────

class DigitPrediction(BaseModel):
    digit:      int   = Field(..., ge=0, le=9, description="Digit class 0–9")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence 0–1")


class PredictResponse(BaseModel):
    top_digit:         int               = Field(..., ge=0, le=9)
    top_confidence:    float             = Field(..., ge=0.0, le=1.0)
    predictions:       list[DigitPrediction]  # top-5, descending confidence
    inference_time_ms: float             = Field(..., description="Wall-clock API latency")
    model_version:     str               = Field(..., description="Model/backend identifier")


# ── Health ────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:       str  = "ok"
    model_loaded: bool = True          # Always true — Claude is always available
    version:      str  = "claude-api"
