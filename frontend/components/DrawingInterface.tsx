"use client";

// DrawingInterface.tsx
// Client island with two input tabs:
//   Draw   — freehand canvas (CanvasDraw)
//   Upload — drag-and-drop image (UploadZone)
//
// Prediction state is shared and cleared on tab switch.
// Zero unnecessary re-renders during drawing (canvas uses refs internally).

import { useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PenLine, ImageUp, Trash2, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import CanvasDraw,  { type CanvasDrawRef } from "./CanvasDraw";
import UploadZone                          from "./UploadZone";
import PredictionCard                      from "./PredictionCard";
import GitHubStyleCard                     from "./GitHubStyleCard";
import { predictDigit, type PredictResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab     = "draw" | "upload";
type PredState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: PredictResponse }
  | { status: "error";   message: string };

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <span className="flex items-center gap-1" aria-label="Loading">
      {[0, 0.15, 0.3].map((delay, i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.9, repeat: Infinity, delay, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DrawingInterface() {
  const canvasRef = useRef<CanvasDrawRef>(null);

  const [activeTab, setActiveTab] = useState<Tab>("draw");
  const [hasDrawn,  setHasDrawn]  = useState(false);
  const [pred,      setPred]      = useState<PredState>({ status: "idle" });

  // ── Tab switch ──────────────────────────────────────────────────────────────

  const switchTab = useCallback((tab: Tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPred({ status: "idle" });
    // Clear canvas when leaving the Draw tab
    if (tab === "upload") {
      canvasRef.current?.clear();
      setHasDrawn(false);
    }
  }, [activeTab]);

  // ── Draw-tab predict ────────────────────────────────────────────────────────

  const handlePredict = useCallback(async () => {
    if (!canvasRef.current || canvasRef.current.isEmpty()) return;
    const base64 = canvasRef.current.getImageData();
    if (!base64) return;

    setPred({ status: "loading" });

    try {
      const data = await predictDigit(base64);
      setPred({ status: "success", data });
    } catch (err) {
      setPred({
        status:  "error",
        message: err instanceof Error ? err.message : "Prediction failed — is the backend running?",
      });
    }
  }, []);

  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
    setPred({ status: "idle" });
    setHasDrawn(false);
  }, []);

  const isLoading  = pred.status === "loading";
  const canPredict = hasDrawn && !isLoading;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <GitHubStyleCard
      noPadding
      title={undefined}
      action={
        pred.status === "success" ? (
          <span className="flex items-center gap-1.5 text-[#1a7f37] text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1a7f37]" />
            Classified
          </span>
        ) : null
      }
    >
      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="flex border-b border-[#d1d9e0] bg-[#f6f8fa]">
        {([ 
          { id: "draw"   as Tab, label: "Draw",         icon: <PenLine  className="w-3.5 h-3.5" /> },
          { id: "upload" as Tab, label: "Upload Image",  icon: <ImageUp  className="w-3.5 h-3.5" /> },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium",
              "border-b-2 -mb-px transition-colors duration-100",
              activeTab === tab.id
                ? "border-[#fd8c73] text-[#1f2328] bg-white"
                : "border-transparent text-[#636c76] hover:text-[#1f2328] hover:bg-white/50"
            )}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <div className="p-4 md:p-5">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === "draw" ? (

            /* ── DRAW TAB ─────────────────────────────────────────────────── */
            <motion.div
              key="draw"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0  }}
              exit={{ opacity: 0, x: -8    }}
              transition={{ duration: 0.15  }}
              className="flex flex-col items-center gap-4"
            >
              {/* Canvas with empty-state overlay */}
              <div className="relative">
                <AnimatePresence>
                  {!hasDrawn && (
                    <motion.div
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 flex flex-col items-center justify-center
                                 pointer-events-none select-none z-10"
                    >
                      <p className="text-[#b1bac4] text-sm font-medium">Draw a digit here</p>
                      <p className="text-[#d1d9e0] text-xs mt-1">0 – 9</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <CanvasDraw
                  ref={canvasRef}
                  onDrawStart={() => setHasDrawn(true)}
                  onDrawEnd={() => setHasDrawn(true)}
                  onClear={() => setHasDrawn(false)}
                  className={cn(
                    "border rounded-md transition-colors duration-150 w-[280px] max-w-full",
                    isLoading
                      ? "border-[#54aeff]"
                      : "border-[#d1d9e0] hover:border-[#b0b7be]"
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 w-full max-w-[280px]">
                <button
                  onClick={handleClear}
                  disabled={!hasDrawn || isLoading}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5",
                    "h-8 px-3 rounded-md border text-sm font-medium transition-colors duration-100",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    "border-[#d1d9e0] bg-white text-[#636c76]",
                    "hover:bg-[#f6f8fa] hover:border-[#b0b7be] hover:text-[#1f2328]",
                    "active:bg-[#ededf4]"
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>

                <button
                  onClick={handlePredict}
                  disabled={!canPredict}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5",
                    "h-8 px-3 rounded-md border text-sm font-medium transition-colors duration-100",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    canPredict && !isLoading
                      ? "btn-shimmer border-[#0550ae] text-white"
                      : "bg-[#0969da] border-[#0550ae] text-white"
                  )}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Analysing</span>
                      <LoadingDots />
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Predict</span>
                    </>
                  )}
                </button>
              </div>

              {/* Draw-tab results */}
              <div className="w-full">
                <AnimatePresence mode="wait">
                  {pred.status === "success" && (
                    <PredictionCard key="ok"  data={pred.data} />
                  )}
                  {pred.status === "error" && (
                    <motion.div
                      key="err"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-2 flex items-start gap-2.5 p-3 rounded-md
                                 border border-[#ffcecb] bg-[#ffebe9]"
                    >
                      <AlertCircle className="w-4 h-4 text-[#cf222e] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-[#cf222e]">Prediction failed</p>
                        <p className="text-xs text-[#82071e] mt-0.5 break-words">{pred.message}</p>
                        <button
                          onClick={handlePredict}
                          className="mt-1.5 text-xs text-[#cf222e] font-medium hover:underline"
                        >
                          Try again →
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

          ) : (

            /* ── UPLOAD TAB ──────────────────────────────────────────────── */
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8   }}
              transition={{ duration: 0.15 }}
            >
              {/* UploadZone manages its own prediction state independently */}
              <UploadZone />
            </motion.div>

          )}
        </AnimatePresence>
      </div>
    </GitHubStyleCard>
  );
}
