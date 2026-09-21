"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  children,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = {
    md: "max-w-xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/50 px-4 py-8">
      <div
        className={cn(
          "flex max-h-[calc(100vh-4rem)] w-full flex-col rounded-[6px] border border-gray-200 bg-white shadow-xl",
          sizeClasses,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        className="flex h-7 w-7 items-center justify-center rounded-[4px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ModalSteps({
  steps,
  activeIndex,
  onStepClick,
}: {
  steps: string[];
  activeIndex: number;
  onStepClick: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 px-5 py-2">
      {steps.map((step, index) => (
        <button
          key={step}
          onClick={() => onStepClick(index)}
          className={cn(
            "flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-xs font-medium transition-colors",
            index === activeIndex
              ? "bg-primary-600 text-white"
              : index < activeIndex
                ? "text-primary-700 hover:bg-primary-50"
                : "text-gray-500 hover:bg-gray-100",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold",
              index === activeIndex
                ? "bg-white/20 text-white"
                : index < activeIndex
                  ? "bg-primary-100 text-primary-700"
                  : "bg-gray-200 text-gray-500",
            )}
          >
            {index + 1}
          </span>
          {step}
        </button>
      ))}
    </div>
  );
}

export function ModalBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>;
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">{children}</div>
  );
}
