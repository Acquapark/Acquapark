"use client";

import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-5 border-b border-gray-200 px-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "relative -mb-px py-3 text-sm font-medium transition-colors",
            active === tab.key ? "text-primary-600" : "text-gray-500 hover:text-gray-700",
          )}
        >
          {tab.label}
          {active === tab.key && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary-600" />
          )}
        </button>
      ))}
    </div>
  );
}
