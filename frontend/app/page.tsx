// app/page.tsx — Server Component
// The page shell is fully static/SSR; DrawingInterface is the only client island.

import dynamic from "next/dynamic";
import { Brain, Github, Layers, Database, Zap, Clock } from "lucide-react";
import GitHubStyleCard from "@/components/GitHubStyleCard";
import ModelInfoCard from "@/components/ModelInfoCard";

// Lazy-load the interactive island — canvas requires browser APIs (no SSR)
const DrawingInterface = dynamic(
  () => import("@/components/DrawingInterface"),
  {
    ssr:     false,
    loading: () => <DrawingInterfaceSkeleton />,
  }
);

// ── Skeleton ─────────────────────────────────────────────────────────────────
function DrawingInterfaceSkeleton() {
  return (
    <div className="border border-[#d1d9e0] rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#d1d9e0] bg-[#f6f8fa]">
        <div className="h-4 w-32 skeleton rounded" />
      </div>
      <div className="p-5 flex flex-col items-center gap-4">
        <div className="w-[280px] h-[280px] skeleton rounded-md" />
        <div className="flex gap-2 w-full max-w-[280px]">
          <div className="h-8 flex-1 skeleton rounded-md" />
          <div className="h-8 flex-1 skeleton rounded-md" />
        </div>
      </div>
    </div>
  );
}

// ── Static data (rendered server-side, zero client JS) ────────────────────────
const MODEL_INFO = {
  name:         "EMNISTNet v2",
  accuracy:     90.78,
  parameters:   "~125 K",
  architecture: "Conv3→BN→Pool → FC → Softmax",
  dataset:      "EMNIST Digits (280,000 samples)",
  inputSize:    "28 × 28 greyscale",
  trainingTime: "~8 min · CPU",
  framework:    "PyTorch 2.x",
};

const HOW_IT_WORKS = [
  {
    icon: <Database className="w-4 h-4" />,
    label: "EMNIST Dataset",
    body:  "The model was trained on 280,000 handwritten digit samples — 28,000 per class — drawn by NIST census participants.",
  },
  {
    icon: <Layers className="w-4 h-4" />,
    label: "CNN Architecture",
    body:  "Three convolutional blocks (Conv → BatchNorm → ReLU → MaxPool), followed by two fully-connected layers and a softmax head.",
  },
  {
    icon: <Zap className="w-4 h-4" />,
    label: "Inference Pipeline",
    body:  "Your canvas is exported as a 280×280 PNG, sent to FastAPI, resized to 28×28, normalised, and classified in milliseconds.",
  },
  {
    icon: <Clock className="w-4 h-4" />,
    label: "Live Confidence",
    body:  "The model returns top-5 class probabilities. The confidence bars update with a physics-based spring animation on every prediction.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#d1d9e0] bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

          {/* Logo / breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <Brain className="w-5 h-5 text-[#0969da] shrink-0" />
            <span className="font-semibold text-[#1f2328] text-sm">Neural Ink</span>
            <span className="text-[#d1d9e0] text-sm select-none">/</span>
            <span className="text-[#636c76] text-sm truncate">digit-recogniser</span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[#636c76]
                         hover:text-[#1f2328] hover:bg-[#f6f8fa]
                         text-sm font-medium transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">Source</span>
            </a>
          </nav>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 md:py-10">

        {/* Hero copy */}
        <div className="mb-7">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                             bg-[#ddf4ff] border border-[#54aeff66]
                             text-[#0969da] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0969da] animate-pulse" />
              Live Demo
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                             bg-[#dafbe1] border border-[#4ac26b66]
                             text-[#1a7f37] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1a7f37]" />
              PyTorch · FastAPI
            </span>
          </div>

          <h1 className="text-2xl md:text-[28px] font-semibold text-[#1f2328] mb-2 tracking-tight text-balance">
            Handwritten Digit Recognition
          </h1>
          <p className="text-[#636c76] text-sm md:text-base max-w-2xl leading-relaxed">
            Draw any digit{" "}
            <code className="px-1 py-0.5 bg-[#f6f8fa] border border-[#d1d9e0] rounded text-[#1f2328] text-xs font-mono">
              0 – 9
            </code>{" "}
            on the canvas. A CNN trained on{" "}
            <span className="text-[#1f2328] font-medium">EMNIST</span> will identify
            it — with confidence scores — in milliseconds.
          </p>
        </div>

        {/* ── Bento grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">

          {/* [1] Drawing interface — spans 2/3 on desktop */}
          <section className="md:col-span-2" aria-label="Drawing canvas">
            <DrawingInterface />
          </section>

          {/* [2] Model info — 1/3 on desktop */}
          <aside className="md:col-span-1" aria-label="Model information">
            <ModelInfoCard info={MODEL_INFO} />
          </aside>

          {/* [3] How it works — full width */}
          <section
            className="md:col-span-3"
            aria-label="How it works"
          >
            <GitHubStyleCard
              title="How it works"
              className="bg-[#f6f8fa]"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {HOW_IT_WORKS.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    {/* Icon pill */}
                    <div className="mt-0.5 shrink-0 p-1.5 rounded-md border border-[#d1d9e0]
                                    bg-white text-[#0969da]">
                      {step.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1f2328] mb-1">
                        {step.label}
                      </p>
                      <p className="text-xs text-[#636c76] leading-relaxed">
                        {step.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </GitHubStyleCard>
          </section>

        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#d1d9e0] mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <span className="text-[#818b98] text-xs">
            PyTorch · FastAPI · Next.js 15
          </span>
          <span className="text-[#818b98] text-xs">
            EMNIST Digits · {new Date().getFullYear()}
          </span>
        </div>
      </footer>

    </div>
  );
}
