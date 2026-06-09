# app/main.py
# FastAPI application entry point.
#
# Endpoints:
#   POST /predict  — classify a handwritten digit via Claude vision API
#   GET  /health   — readiness probe for Render / load balancers
#   GET  /         — root redirect to /docs

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from anthropic import APIStatusError, APITimeoutError

from .models import PredictRequest, PredictResponse, HealthResponse
from .inference import classify_digit, CLAUDE_MODEL

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── CORS origins ──────────────────────────────────────────────────────────────
# Add your Vercel deployment URL here (or set ALLOWED_ORIGINS env var).

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001"
)
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Neural Ink backend starting — model: %s", CLAUDE_MODEL)
    logger.info("Allowed origins: %s", ALLOWED_ORIGINS)
    yield
    logger.info("Neural Ink backend shutting down")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Neural Ink — Digit Recognition API",
    description=(
        "Classifies handwritten digits (0–9) using Claude's vision API. "
        "POST a base64-encoded PNG to /predict and receive top-5 class probabilities."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── Global exception handler ──────────────────────────────────────────────────

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root():
    """Redirect to interactive API docs."""
    return RedirectResponse(url="/docs")


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    tags=["meta"],
)
async def health():
    """
    Lightweight readiness probe.
    Returns 200 if the API is running and the Anthropic key is configured.
    """
    api_key_set = bool(os.getenv("ANTHROPIC_API_KEY"))
    return HealthResponse(
        status="ok" if api_key_set else "degraded",
        model_loaded=api_key_set,
        version=f"Claude/{CLAUDE_MODEL}",
    )


@app.post(
    "/predict",
    response_model=PredictResponse,
    summary="Classify a handwritten digit",
    tags=["inference"],
    responses={
        200: {"description": "Top-5 digit predictions with confidence scores"},
        400: {"description": "Blank canvas or invalid image"},
        422: {"description": "Request body validation failed"},
        429: {"description": "Anthropic API rate limit reached"},
        502: {"description": "Anthropic API error"},
        504: {"description": "Anthropic API timed out"},
    },
)
async def predict(body: PredictRequest):
    """
    Classify a handwritten digit image using Claude's vision API.

    **Request body:**
    ```json
    { "image": "<base64-encoded PNG, no data-URL prefix>" }
    ```

    **Response:**
    ```json
    {
      "top_digit": 7,
      "top_confidence": 0.9341,
      "predictions": [
        {"digit": 7, "confidence": 0.9341},
        {"digit": 1, "confidence": 0.0412},
        ...
      ],
      "inference_time_ms": 623.4,
      "model_version": "Claude/claude-haiku-4-5-20251001"
    }
    ```
    """
    try:
        result = classify_digit(body.image)
        return PredictResponse(**result)

    except ValueError as exc:
        # Blank canvas, corrupt image, parse failure
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:
        # Missing API key
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    except APITimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=(
                "The Claude API timed out. "
                "This sometimes happens on Render free tier cold starts — please retry."
            ),
        ) from exc

    except APIStatusError as exc:
        if exc.status_code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Anthropic API rate limit reached. Please wait a moment and try again.",
            ) from exc
        logger.error("Anthropic API error %s: %s", exc.status_code, exc.message)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Anthropic API returned an error: {exc.message}",
        ) from exc
