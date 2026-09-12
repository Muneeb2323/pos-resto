import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "fire" | "success";
  size?: "default" | "sm" | "lg" | "icon" | "xl";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] transition-transform select-none";

    const variantStyles = {
      default: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:bg-zinc-600 border border-zinc-700",
      fire: "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-600/25 border-none font-semibold",
      destructive: "bg-red-600/90 text-white hover:bg-red-500 active:bg-red-700 border border-red-500/30",
      success: "bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 border border-emerald-500/30",
      outline: "border border-zinc-700 bg-transparent hover:bg-zinc-800/80 text-zinc-200 hover:text-white",
      secondary: "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800",
      ghost: "hover:bg-zinc-800/60 text-zinc-300 hover:text-white",
      link: "text-orange-400 underline-offset-4 hover:underline",
    }[variant];

    const sizeStyles = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-12 rounded-lg px-6 text-base font-semibold",
      xl: "h-14 rounded-xl px-8 text-lg font-bold tracking-wide",
      icon: "h-10 w-10 p-0",
    }[size];

    return (
      <button
        className={cn(baseStyles, variantStyles, sizeStyles, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
