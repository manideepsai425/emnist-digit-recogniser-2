"use client";

// CanvasDraw.tsx
// High-performance drawing canvas for the EMNIST digit recogniser.
//
// Performance contract:
//   • Zero React state mutations during drawing — all refs.
//   • Pointer events coalesced with requestAnimationFrame.
//   • Midpoint bezier algorithm for smooth, calligraphic strokes.
//   • setPointerCapture() ensures reliable touch tracking.
//   • DPR-aware canvas: crisp on retina, consistent coordinates everywhere.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

/** CSS display size of the canvas. Backend receives a 280×280 PNG. */
const CANVAS_SIZE  = 280;

/** Drawing stroke width in CSS pixels. Matches MNIST digit proportions. */
const STROKE_WIDTH = 18;

/** Ink colour — GitHub's darkest foreground. */
const STROKE_COLOR = "#1F2328";

// ── Public API ────────────────────────────────────────────────────────────────

export interface CanvasDrawRef {
  /** Erase all strokes and reset internal state. */
  clear:        () => void;
  /** Return base64-encoded PNG (no data-URL prefix) for the backend. */
  getImageData: () => string;
  /** True if the canvas is blank (never drawn or just cleared). */
  isEmpty:      () => boolean;
}

interface CanvasDrawProps {
  onDrawStart?: () => void;
  onDrawEnd?:   () => void;
  onClear?:     () => void;
  className?:   string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const CanvasDraw = forwardRef<CanvasDrawRef, CanvasDrawProps>(
  ({ onDrawStart, onDrawEnd, onClear, className }, ref) => {
    // ── Refs (no React state touched during drawing) ─────────────────────────
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const ctxRef       = useRef<CanvasRenderingContext2D | null>(null);

    // Drawing state
    const isDrawingRef = useRef(false);
    const hasDrawnRef  = useRef(false);

    // Smooth midpoint bezier state
    const lastPtRef    = useRef({ x: 0, y: 0 });
    const prevMidRef   = useRef<{ x: number; y: number } | null>(null);
    const pendingPtRef = useRef({ x: 0, y: 0 });

    // RAF handle (0 = no pending frame)
    const rafRef       = useRef<number>(0);

    // Cached scale: CSS-pixel → canvas-coordinate. Recomputed on resize.
    const scaleRef     = useRef({ x: 1, y: 1 });

    // ── Canvas initialisation ─────────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

      // Physical pixels
      canvas.width  = CANVAS_SIZE * dpr;
      canvas.height = CANVAS_SIZE * dpr;

      // CSS pixels (responsive max handled by Tailwind classes on wrapper)
      canvas.style.width  = `${CANVAS_SIZE}px`;
      canvas.style.height = `${CANVAS_SIZE}px`;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctxRef.current = ctx;

      // Scale context so all draw calls use CSS-pixel coordinates
      ctx.scale(dpr, dpr);

      // Drawing style
      ctx.strokeStyle = STROKE_COLOR;
      ctx.fillStyle   = STROKE_COLOR;
      ctx.lineWidth   = STROKE_WIDTH;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";

      // White background (matches GitHub aesthetic; backend inverts for EMNIST)
      _fillWhite(ctx);
    }, []);

    // Update scale whenever the canvas rect changes (e.g., zoom, orientation)
    const updateScale = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      scaleRef.current = {
        x: CANVAS_SIZE / rect.width,
        y: CANVAS_SIZE / rect.height,
      };
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────────

    const _fillWhite = (ctx: CanvasRenderingContext2D) => {
      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.restore();
    };

    /**
     * Map a pointer event's client coordinates to canvas coordinates.
     * Must be called during an event handler (rect is live).
     */
    const getPos = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect   = canvas.getBoundingClientRect();
        return {
          x: (e.clientX - rect.left) * scaleRef.current.x,
          y: (e.clientY - rect.top)  * scaleRef.current.y,
        };
      },
      []
    );

    /**
     * RAF callback — draws one smooth bezier segment per frame.
     * Uses the classic midpoint algorithm:
     *   moveTo(prevMid) → quadraticCurveTo(lastPt, newMid)
     * This guarantees C1 continuity: every stroke is smooth.
     */
    const renderSegment = useCallback(() => {
      rafRef.current = 0;
      const ctx = ctxRef.current;
      if (!ctx || !isDrawingRef.current) return;

      const cur = pendingPtRef.current;
      const lst = lastPtRef.current;
      const mid = { x: (lst.x + cur.x) / 2, y: (lst.y + cur.y) / 2 };

      ctx.beginPath();

      if (prevMidRef.current) {
        // Smooth continuation: bezier through prevMid → lst → mid
        ctx.moveTo(prevMidRef.current.x, prevMidRef.current.y);
        ctx.quadraticCurveTo(lst.x, lst.y, mid.x, mid.y);
      } else {
        // First segment: simple line to the midpoint
        ctx.moveTo(lst.x, lst.y);
        ctx.lineTo(mid.x, mid.y);
      }

      ctx.stroke();

      prevMidRef.current = mid;
      lastPtRef.current  = cur;
    }, []);

    // ── Event handlers ────────────────────────────────────────────────────────

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        // Lock pointer to this element for the full stroke (critical for touch)
        e.currentTarget.setPointerCapture(e.pointerId);

        updateScale();
        const pos = getPos(e);

        isDrawingRef.current = true;
        hasDrawnRef.current  = true;
        lastPtRef.current    = pos;
        prevMidRef.current   = null;
        pendingPtRef.current = pos;

        // Paint an initial dot so single taps register
        const ctx = ctxRef.current!;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, STROKE_WIDTH / 2, 0, Math.PI * 2);
        ctx.fill();

        onDrawStart?.();
      },
      [getPos, onDrawStart, updateScale]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        e.preventDefault();

        // Update pending position (multiple events coalesce into one RAF)
        pendingPtRef.current = getPos(e);

        // Schedule render only if no frame is already pending
        if (rafRef.current !== 0) return;
        rafRef.current = requestAnimationFrame(renderSegment);
      },
      [getPos, renderSegment]
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        e.preventDefault();

        // Cancel any pending RAF to avoid drawing after lift
        if (rafRef.current !== 0) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }

        isDrawingRef.current = false;
        prevMidRef.current   = null;
        onDrawEnd?.();
      },
      [onDrawEnd]
    );

    // ── Imperative API ────────────────────────────────────────────────────────

    useImperativeHandle(
      ref,
      () => ({
        clear() {
          const ctx = ctxRef.current;
          if (!ctx) return;
          _fillWhite(ctx);
          hasDrawnRef.current = false;
          prevMidRef.current  = null;
          onClear?.();
        },

        getImageData() {
          const canvas = canvasRef.current;
          if (!canvas) return "";

          // Produce a normalised 280×280 PNG regardless of device DPR.
          const off = document.createElement("canvas");
          off.width  = CANVAS_SIZE;
          off.height = CANVAS_SIZE;
          const offCtx = off.getContext("2d")!;
          offCtx.drawImage(canvas, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

          // Strip the "data:image/png;base64," prefix — backend expects raw b64
          return off.toDataURL("image/png").split(",")[1] ?? "";
        },

        isEmpty() {
          return !hasDrawnRef.current;
        },
      }),
      [onClear]
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <canvas
        ref={canvasRef}
        className={cn("rounded-md", className)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}   // Treat leaving as lifting
        onPointerCancel={handlePointerUp}  // Handle OS interrupts (calls, alerts)
        style={{
          touchAction:             "none",  // Disable scroll/zoom during drawing
          cursor:                  "crosshair",
          WebkitTapHighlightColor: "transparent",
          willChange:              "contents", // GPU hint for compositing
        }}
      />
    );
  }
);

CanvasDraw.displayName = "CanvasDraw";
export default CanvasDraw;
