import base64
import io
import os
import time
import logging

import requests
from PIL import Image

from .utils import is_blank_image

logger = logging.getLogger(__name__)

HF_API_KEY = os.getenv("HF_API_KEY", "")
HF_MODEL   = os.getenv("HF_MODEL", "farleyknight-org-username/vit-base-mnist")
HF_API_URL = f"https://api-inference.huggingface.co/models/{HF_MODEL}"


def _base64_to_bytes(base64_str: str) -> bytes:
    raw = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img = img.resize((28, 28), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _normalise(raw: list[dict]) -> list[dict]:
    predictions = [
        {"digit": int(p["label"]), "confidence": float(p["score"])}
        for p in raw
        if str(p["label"]).isdigit()
    ]
    predictions.sort(key=lambda x: x["confidence"], reverse=True)

    seen = {p["digit"] for p in predictions}
    for d in range(10):
        if len(predictions) >= 5:
            break
        if d not in seen:
            predictions.append({"digit": d, "confidence": 0.0})
            seen.add(d)

    predictions = predictions[:5]

    total = sum(p["confidence"] for p in predictions)
    if total > 0:
        for p in predictions:
            p["confidence"] = round(p["confidence"] / total, 4)

    return predictions


def classify_digit(base64_image: str) -> dict:
    if is_blank_image(base64_image):
        raise ValueError("Canvas is blank — draw a digit first.")

    if not HF_API_KEY:
        raise RuntimeError("HF_API_KEY environment variable is not set.")

    image_bytes = _base64_to_bytes(base64_image)

    t0 = time.perf_counter()

    response = requests.post(
        HF_API_URL,
        headers={
            "Authorization": f"Bearer {HF_API_KEY}",
            "Content-Type":  "application/octet-stream",
        },
        data=image_bytes,
        timeout=30,
    )

    elapsed_ms = (time.perf_counter() - t0) * 1000

    if response.status_code == 503:
        raise RuntimeError("Model is loading on HuggingFace — wait 20 seconds and try again.")

    if not response.ok:
        raise RuntimeError(f"HuggingFace API error {response.status_code}: {response.text}")

    raw = response.json()
    logger.debug("HF raw response: %s", raw)

    predictions   = _normalise(raw)
    top_digit     = predictions[0]["digit"]
    top_confidence = predictions[0]["confidence"]

    return {
        "top_digit":         top_digit,
        "top_confidence":    top_confidence,
        "predictions":       predictions,
        "inference_time_ms": round(elapsed_ms, 2),
        "model_version":     f"HuggingFace/{HF_MODEL}",
    }
