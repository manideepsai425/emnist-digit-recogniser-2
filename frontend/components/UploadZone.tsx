"use client";

// UploadZone.tsx
// Drag-and-drop / click-to-browse image upload for digit prediction.
// Accepts PNG, JPEG, GIF — validates, previews, then calls the API.
// Designed to sit alongside or replace the canvas for image-based input.

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Upload, ImageIcon, X, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import PredictionCard from "./PredictionCard";
import { predictDigit, type PredictResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE  = 5 * 1024 * 1024; // 5 MB

// ── Types ─────────────────────────────────────────────────────────────────────

type UploadState =
  | { status: "idle" }
  | { status: "ready";   file: File; preview: string }
  | { status: "loading"; file: File; preview: string }
  | { status: "success"; file: File; preview: string; data: PredictResponse }
  | { status: "error";   file: File; preview: string; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert an image File → base64 PNG (280×280) via an offscreen canvas.
 * This normalises the image to the same format the drawing canvas exports.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas  = document.createElement("canvas");
      canvas.width  = 280;
      canvas.height = 280;
      const ctx = canvas.getContext("2d")!;

      // White background (matches drawing canvas)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 280, 280);

      // Draw image centred & scaled to fit, maintaining aspect ratio
      const scale = Math.min(240 / img.width, 240 / img.height);
      const x     = (280 - img.width  * scale) / 2;
      const y     = (280 - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png").split(",")[1] ?? "");
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

function validateFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return "Unsupported format. Use PNG, JPEG, GIF, or WebP.";
  if (file.size > MAX_SIZE)          return "File too large. Maximum size is 5 MB.";
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface UploadZoneProps {
  className?: string;
}

export default function UploadZone({ className }: UploadZoneProps) {
  const inputRef      = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [isDragging, setIsDragging]   = useState(false);
  const [fileError, setFileError]     = useState<string | null>(null);

  // ── File processing ─────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) { setFileError(error); return; }

    setFileError(null);
    const preview = URL.createObjectURL(file);
    setState({ status: "ready", file, preview });
  }, []);

  // ── Predict ─────────────────────────────────────────────────────────────────

  const handlePredict = useCallback(async () => {
    if (state.status !== "ready" && state.status !== "error") return;
    const { file, preview } = state;

    setState({ status: "loading", file, preview });

    try {
      const base64 = await fileToBase64(file);
      const data   = await predictDigit(base64);
      setState({ status: "success", file, preview, data });
    } catch (err) {
      setState({
        status:  "error",
        file,
        preview,
        message: err instanceof Error ? err.message : "Prediction failed",
      });
    }
  }, [state]);

  // ── Reset ────────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    if ("preview" in state) URL.revokeObjectURL(state.preview);
    setState({ status: "idle" });
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [state]);

  // ── Drag events ──────────────────────────────────────────────────────────────

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true);  };
  const onDragLeave = ()                    => setIsDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const hasFile   = state.status !== "idle";
  const isLoading = state.status === "loading";

  return (
    <div className={cn("flex flex-col gap-4", className)}>

      {/* Drop zone */}
      <AnimatePresence mode="wait">
        {!hasFile ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => inputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "w-[280px] max-w-full h-[280px] mx-auto",
              "flex flex-col items-center justify-center gap-3",
              "border-2 border-dashed rounded-lg cursor-pointer",
              "transition-colors duration-150 select-none",
              isDragging
                ? "border-[#0969da] bg-[#ddf4ff]"
                : "border-[#d1d9e0] bg-[#f6f8fa] hover:border-[#0969da] hover:bg-[#f0f6ff]"
            )}
          >
            <div className={cn(
              "p-3 rounded-full border transition-colors duration-150",
              isDragging ? "border-[#54aeff] bg-white" : "border-[#d1d9e0] bg-white"
            )}>
              <Upload className={cn(
                "w-5 h-5 transition-colors duration-150",
                isDragging ? "text-[#0969da]" : "text-[#818b98]"
              )} />
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-[#1f2328]">
                {isDragging ? "Drop it here" : "Drop an image, or click to browse"}
              </p>
              <p className="text-xs text-[#636c76] mt-1">PNG · JPEG · GIF · WebP · max 5 MB</p>
            </div>
          </motion.div>

        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative w-[280px] max-w-full mx-auto"
          >
            {/* Preview image */}
            <div className="w-[280px] h-[280px] relative border border-[#d1d9e0] rounded-lg overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={"preview" in state ? state.preview : ""}
                alt="Uploaded digit preview"
                className="w-full h-full object-contain p-4"
              />

              {/* Loading overlay */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-[1px]"
                  >
                    <RefreshCw className="w-6 h-6 text-[#0969da] animate-spin" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* File info strip */}
            <div className="mt-2 flex items-center gap-2 px-1">
              <ImageIcon className="w-3.5 h-3.5 text-[#636c76] shrink-0" />
              <span className="text-xs text-[#636c76] truncate flex-1 font-mono">
                {"file" in state ? state.file.name : ""}
              </span>
              <button
                onClick={handleReset}
                disabled={isLoading}
                className="p-0.5 rounded hover:bg-[#f6f8fa] text-[#818b98]
                           hover:text-[#cf222e] transition-colors disabled:opacity-40"
                aria-label="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        onChange={onInputChange}
        className="sr-only"
        aria-label="Upload digit image"
      />

      {/* File validation error */}
      <AnimatePresence>
        {fileError && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 text-xs text-[#cf222e] px-1"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {fileError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Predict button */}
      <div className="flex gap-2 w-full max-w-[280px] mx-auto">
        <button
          onClick={handleReset}
          disabled={!hasFile || isLoading}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5",
            "h-8 px-3 rounded-md border text-sm font-medium",
            "transition-colors duration-100",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "border-[#d1d9e0] bg-white text-[#636c76]",
            "hover:bg-[#f6f8fa] hover:border-[#b0b7be] hover:text-[#1f2328]"
          )}
        >
          Clear
        </button>

        <button
          onClick={handlePredict}
          disabled={!hasFile || isLoading}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5",
            "h-8 px-3 rounded-md border text-sm font-medium",
            "transition-colors duration-100",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            hasFile && !isLoading
              ? "btn-shimmer border-[#0550ae] text-white"
              : "bg-[#0969da] border-[#0550ae] text-white"
          )}
        >
          {isLoading ? (
            <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Analysing</span></>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /><span>Predict</span></>
          )}
        </button>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {state.status === "success" && (
          <PredictionCard key="result" data={state.data} />
        )}
        {state.status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 p-3 rounded-md border border-[#ffcecb] bg-[#ffebe9]"
          >
            <AlertCircle className="w-4 h-4 text-[#cf222e] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#cf222e]">Prediction failed</p>
              <p className="text-xs text-[#82071e] mt-0.5">{state.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
