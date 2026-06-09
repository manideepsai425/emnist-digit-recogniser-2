"use client";

// PredictionCard.tsx
// Displays top-5 digit predictions with animated confidence bars.
// Uses Framer Motion with spring physics for fluid, responsive reveals.
// Deliberately restraint on animation — purposeful, not decorative.

import { motion, AnimatePresence } from "framer-motion";
import type { PredictResponse } from "@/lib/api";
import { formatPct, formatMs } from "@/lib/utils";

interface PredictionCardProps {
  data: PredictResponse;
}

// Spring config — confident, not bouncy
const SPRING = { type: "spring", stiffness: 300, damping: 35 } as const;

// Stagger delay per confidence bar (seconds)
const BAR_STAGGER = 0.07;

export default function PredictionCard({ data }: PredictionCardProps) {
  const { predictions, top_digit, top_confidence, inference_time_ms } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mt-4 border border-[#d1d9e0] rounded-lg bg-white overflow-hidden
                 shadow-[0_1px_2px_rgba(31,35,40,0.06)]"
    >
      {/* ── Top prediction hero ─────────────────────────────────────────── */}
      <div className="flex items-center gap-5 px-4 pt-4 pb-4 border-b border-[#e6edf3]">

        {/* Big digit display */}
        <motion.div
          key={top_digit}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          transition={{ ...SPRING, delay: 0.05 }}
          className="flex-shrink-0 w-16 h-16 flex items-center justify-center
                     rounded-lg border-2 border-[#0969da] bg-[#ddf4ff]"
        >
          <span className="font-mono text-[36px] font-bold text-[#0969da] leading-none select-none">
            {top_digit}
          </span>
        </motion.div>

        <div className="min-w-0">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xs font-medium text-[#636c76] uppercase tracking-wide mb-1"
          >
            Best match
          </motion.p>
          <motion.p
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING, delay: 0.12 }}
            className="text-2xl font-semibold text-[#1f2328] leading-none"
          >
            {formatPct(top_confidence)}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="text-xs text-[#818b98] mt-1"
          >
            confidence
          </motion.p>
        </div>

        {/* Inference time badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22 }}
          className="ml-auto shrink-0 self-start"
        >
          <span className="px-2 py-1 bg-[#f6f8fa] border border-[#d1d9e0]
                           rounded text-[11px] font-mono text-[#636c76]">
            {formatMs(inference_time_ms)}
          </span>
        </motion.div>
      </div>

      {/* ── Confidence bars ─────────────────────────────────────────────── */}
      <div className="px-4 py-3 space-y-2.5">
        <AnimatePresence>
          {predictions.map((pred, i) => (
            <motion.div
              key={pred.digit}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING, delay: i * BAR_STAGGER }}
            >
              <div className="flex items-center gap-2.5">
                {/* Digit label */}
                <span
                  className="w-5 text-center font-mono text-sm font-semibold
                             text-[#1f2328] shrink-0 select-none"
                >
                  {pred.digit}
                </span>

                {/* Track */}
                <div className="relative flex-1 h-2 bg-[#f0f2f5] rounded-full overflow-hidden">
                  {/* Fill */}
                  <motion.div
                    className={
                      i === 0
                        ? "h-full rounded-full bg-[#0969da]"
                        : "h-full rounded-full bg-[#54aeff]"
                    }
                    initial={{ width: 0 }}
                    animate={{ width: `${pred.confidence * 100}%` }}
                    transition={{
                      type:      "spring",
                      stiffness: 200,
                      damping:   30,
                      delay:     i * BAR_STAGGER + 0.05,
                    }}
                    style={{ originX: 0 }}
                  />
                </div>

                {/* Percentage */}
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * BAR_STAGGER + 0.15 }}
                  className="w-12 text-right font-mono text-xs text-[#636c76] shrink-0 tabular-nums"
                >
                  {formatPct(pred.confidence)}
                </motion.span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
