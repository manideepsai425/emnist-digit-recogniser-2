# app/inference.py
# Digit classification via Claude's vision API.
#
# Why Claude instead of a local PyTorch model?
#   • Zero training infrastructure — one API key and you're live.
#   • No model files to host or version — Render free tier stays lean.
#   • claude-haiku is fast (~600 ms) and accurate on clear handwriting.
#   • Easy to swap to claude-sonnet-4-6 for higher accuracy on ambiguous input.
#
# Flow:
#   base64 PNG → preprocess → Claude vision API → parse JSON → normalise → return

import json
import os
import re
import time
import logging
from functools import lru_cache

from anthropic import Anthropic, APIStatusError, APITimeoutError

from .utils import preprocess_for_claude, is_blank_image

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

CLAUDE_MODEL   = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5-20251001")
API_KEY        = os.getenv("ANTHROPIC_API_KEY", "")
MAX_TOKENS     = 300   # JSON is small; generous budget for thinking tokens

# ── Prompt ────────────────────────────────────────────────────────────────────
# The system prompt is the single most important tuning lever here.
# Key constraints:
#   1. Output ONLY raw JSON — no markdown, no prose.
#   2. Exactly 5 predictions, confidence sums to 1.0.
#   3. Reflect genuine uncertainty (don't just put 0.99 on every clear digit).

SYSTEM_PROMPT = """\
You are an expert handwritten digit classifier trained on the EMNIST dataset.

Your task: look at the image and identify the handwritten digit (0–9).

Respond with ONLY a raw JSON object — no markdown fences, no explanation, no preamble.
Any text outside the JSON will cause an error.

Required schema:
{
  "top_digit": <integer 0–9>,
  "predictions": [
    {"digit": <int>, "confidence": <float>},
    {"digit": <int>, "confidence": <float>},
    {"digit": <int>, "confidence": <float>},
    {"digit": <int>, "confidence": <float>},
    {"digit": <int>, "confidence": <float>}
  ]
}

Rules:
- top_digit is the integer (0–9) you are most confident about.
- predictions has EXACTLY 5 entries — your top 5 candidate digits.
- Sorted by confidence descending (highest first).
- All confidence values are positive floats that SUM TO EXACTLY 1.0.
- If the digit is clear, concentrate confidence (e.g. 0.95 + small residuals).
- If ambiguous (e.g. 1 vs 7, 4 vs 9), spread confidence to reflect true uncertainty.
- Never include the same digit twice in predictions.
"""

USER_MESSAGE = "Classify the handwritten digit in this image."

# ── Client (singleton) ────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_client() -> Anthropic:
    if not API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY environment variable is not set. "
            "Add it to your .env file or Render environment."
        )
    return Anthropic(api_key=API_KEY)


# ── Parsing helpers ───────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    """Remove markdown code fences if Claude adds them despite instructions."""
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```", "", text)
    return text.strip()


def _parse_response(raw: str) -> dict:
    """
    Parse Claude's text into a validated predictions dict.
    Falls back gracefully if the JSON is slightly malformed.
    """
    cleaned = _strip_fences(raw)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Last resort: extract the JSON object with regex
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise ValueError(f"No JSON object found in Claude response: {raw!r}")
        data = json.loads(match.group())

    # Validate top_digit
    top_digit = int(data["top_digit"])
    if not (0 <= top_digit <= 9):
        raise ValueError(f"top_digit {top_digit} out of range 0–9")

    # Validate predictions list
    raw_preds = data.get("predictions", [])
    if not isinstance(raw_preds, list) or len(raw_preds) == 0:
        raise ValueError("predictions must be a non-empty list")

    predictions = [
        {"digit": int(p["digit"]), "confidence": float(p["confidence"])}
        for p in raw_preds
    ]

    return {"top_digit": top_digit, "predictions": predictions}


def _normalise(top_digit: int, predictions: list[dict]) -> tuple[int, list[dict], float]:
    """
    Ensure:
      - Exactly 5 unique-digit predictions.
      - Confidence values sum to 1.0.
      - Sorted by confidence descending.
    Returns (top_digit, predictions, top_confidence).
    """
    # Deduplicate by digit (keep highest confidence entry)
    seen: dict[int, float] = {}
    for p in predictions:
        d = p["digit"]
        if d not in seen or p["confidence"] > seen[d]:
            seen[d] = p["confidence"]

    # Pad to 5 entries with zero-confidence fillers if needed
    for d in range(10):
        if len(seen) >= 5:
            break
        if d not in seen:
            seen[d] = 0.0

    # Sort descending, take top 5
    sorted_preds = sorted(seen.items(), key=lambda x: x[1], reverse=True)[:5]

    # Normalise so confidences sum to 1.0
    total = sum(c for _, c in sorted_preds)
    if total <= 0:
        logger.warning("All-zero confidences — falling back to uniform distribution")
        sorted_preds = [(d, 0.2) for d, _ in sorted_preds]
        total = 1.0

    normalised = [
        {"digit": d, "confidence": round(c / total, 4)}
        for d, c in sorted_preds
    ]

    # Correct top_digit to match the highest-confidence entry if they disagree
    if normalised[0]["digit"] != top_digit:
        logger.debug(
            "top_digit %d overridden by highest-confidence prediction %d",
            top_digit, normalised[0]["digit"]
        )
        top_digit = normalised[0]["digit"]

    top_confidence = normalised[0]["confidence"]
    return top_digit, normalised, top_confidence


# ── Public API ────────────────────────────────────────────────────────────────

def classify_digit(base64_image: str) -> dict:
    """
    Classify a handwritten digit from a base64 PNG.

    Returns a dict matching PredictResponse:
      {
        top_digit, top_confidence, predictions,
        inference_time_ms, model_version
      }

    Raises:
      ValueError  — blank canvas or malformed image
      RuntimeError — API key missing
      APIStatusError — Anthropic API error (rate limit, auth, etc.)
      APITimeoutError — request timed out
    """
    # Reject blank canvases before paying for an API call
    if is_blank_image(base64_image):
        raise ValueError(
            "The canvas appears to be blank — please draw a digit before predicting."
        )

    # Preprocess: resize, contrast boost, sharpen
    processed_image = preprocess_for_claude(base64_image)

    client = _get_client()
    t0 = time.perf_counter()

    try:
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type":       "base64",
                                "media_type": "image/png",
                                "data":       processed_image,
                            },
                        },
                        {
                            "type": "text",
                            "text": USER_MESSAGE,
                        },
                    ],
                }
            ],
        )
    except APITimeoutError as exc:
        raise APITimeoutError("Claude API timed out — please try again.") from exc
    except APIStatusError as exc:
        logger.error("Anthropic API error %s: %s", exc.status_code, exc.message)
        raise

    elapsed_ms = (time.perf_counter() - t0) * 1000

    raw_text = message.content[0].text
    logger.debug("Claude raw response: %s", raw_text)

    parsed = _parse_response(raw_text)
    top_digit, predictions, top_confidence = _normalise(
        parsed["top_digit"], parsed["predictions"]
    )

    return {
        "top_digit":         top_digit,
        "top_confidence":    top_confidence,
        "predictions":       predictions,
        "inference_time_ms": round(elapsed_ms, 2),
        "model_version":     f"Claude/{CLAUDE_MODEL}",
    }
