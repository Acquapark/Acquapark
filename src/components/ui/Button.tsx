import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300 border border-primary-600 disabled:border-gray-300",
  secondary:
    "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 disabled:text-gray-400",
  outline:
    "bg-transparent text-primary-600 hover:bg-primary-50 border border-primary-600 disabled:text-gray-400 disabled:border-gray-300",
  ghost:
    "bg-transparent text-gray-600 hover:bg-gray-100 border border-transparent disabled:text-gray-400",
  destructive:
    "bg-white text-danger-600 hover:bg-danger-50 border border-danger-600 disabled:text-gray-400 disabled:border-gray-300",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-10 px-5 text-sm gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-[4px] font-medium transition-colors whitespace-nowrap select-none disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
