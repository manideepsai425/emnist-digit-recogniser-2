// components/ModelInfoCard.tsx
// Static model information card — fully server-renderable (no "use client").
// Displays architecture stats in a clean GitHub-style layout.

import { Cpu, BarChart3, Layers, FlaskConical, Clock, Hash } from "lucide-react";
import GitHubStyleCard from "./GitHubStyleCard";

interface ModelInfo {
  name:         string;
  accuracy:     number;
  parameters:   string;
  architecture: string;
  dataset:      string;
  inputSize:    string;
  trainingTime: string;
  framework:    string;
}

interface ModelInfoCardProps {
  info: ModelInfo;
}

const STATS = (info: ModelInfo) => [
  {
    icon:  <BarChart3 className="w-3.5 h-3.5" />,
    label: "Validation accuracy",
    value: `${info.accuracy.toFixed(2)}%`,
    emphasis: true,
  },
  {
    icon:  <Hash className="w-3.5 h-3.5" />,
    label: "Parameters",
    value: info.parameters,
  },
  {
    icon:  <Layers className="w-3.5 h-3.5" />,
    label: "Architecture",
    value: info.architecture,
    mono:  true,
    small: true,
  },
  {
    icon:  <FlaskConical className="w-3.5 h-3.5" />,
    label: "Dataset",
    value: info.dataset,
    small: true,
  },
  {
    icon:  <Cpu className="w-3.5 h-3.5" />,
    label: "Input",
    value: info.inputSize,
    mono:  true,
  },
  {
    icon:  <Clock className="w-3.5 h-3.5" />,
    label: "Training time",
    value: info.trainingTime,
  },
];

export default function ModelInfoCard({ info }: ModelInfoCardProps) {
  const stats = STATS(info);

  return (
    <GitHubStyleCard
      title={info.name}
      subtitle={info.framework}
      className="h-full"
    >
      <div className="space-y-3">

        {/* Accuracy hero stat */}
        <div className="p-3 rounded-md bg-[#ddf4ff] border border-[#54aeff66]">
          <div className="flex items-center gap-1.5 text-[#0969da] mb-1">
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Validation accuracy</span>
          </div>
          <p className="text-2xl font-bold font-mono text-[#0550ae]">
            {info.accuracy.toFixed(2)}
            <span className="text-sm font-semibold ml-0.5">%</span>
          </p>
          <p className="text-xs text-[#0969da] mt-0.5">on EMNIST Digits test set</p>
        </div>

        {/* Remaining stats */}
        <div className="divide-y divide-[#e6edf3]">
          {stats.slice(1).map((stat, i) => (
            <div key={i} className="flex items-start gap-2 py-2.5 first:pt-0 last:pb-0">
              <span className="mt-0.5 text-[#818b98] shrink-0">{stat.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#636c76] mb-0.5">{stat.label}</p>
                <p
                  className={[
                    "text-[13px] font-medium text-[#1f2328]",
                    stat.mono  ? "font-mono"   : "",
                    stat.small ? "text-[11px] break-words" : "",
                  ].join(" ")}
                >
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Tech badges */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["PyTorch", "FastAPI", "EMNIST", "Next.js"].map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[11px] font-medium rounded-full
                         border border-[#d1d9e0] bg-[#f6f8fa] text-[#636c76]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </GitHubStyleCard>
  );
}
