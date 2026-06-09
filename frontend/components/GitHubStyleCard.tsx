// components/GitHubStyleCard.tsx
// Reusable GitHub-style card: bordered container with optional header bar.

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GitHubStyleCardProps {
  title?:       string;
  subtitle?:    string;
  action?:      ReactNode;    // Right-aligned header action slot
  children:     ReactNode;
  className?:   string;       // Applied to the card body
  headerClass?: string;       // Applied to the header bar
  noPadding?:   boolean;      // Skip default body padding
}

export default function GitHubStyleCard({
  title,
  subtitle,
  action,
  children,
  className,
  headerClass,
  noPadding = false,
}: GitHubStyleCardProps) {
  const hasHeader = title || action;

  return (
    <div className="border border-[#d1d9e0] rounded-lg bg-white overflow-hidden shadow-[0_1px_2px_rgba(31,35,40,0.06)]">
      {/* Header bar */}
      {hasHeader && (
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            "px-4 py-3 border-b border-[#d1d9e0] bg-[#f6f8fa]",
            headerClass
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-[#1f2328] truncate">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-[#636c76] mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      {/* Body */}
      <div className={cn(!noPadding && "p-4 md:p-5", className)}>
        {children}
      </div>
    </div>
  );
}
