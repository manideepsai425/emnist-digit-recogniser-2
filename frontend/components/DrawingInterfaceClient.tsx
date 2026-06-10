"use client";

import dynamic from "next/dynamic";

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

const DrawingInterface = dynamic(
  () => import("@/components/DrawingInterface"),
  {
    ssr:     false,
    loading: () => <DrawingInterfaceSkeleton />,
  }
);

export default DrawingInterface;
