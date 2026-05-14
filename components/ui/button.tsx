import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90":
              variant === "default",
            "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:opacity-90":
              variant === "destructive",
            "border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]":
              variant === "outline",
            "hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]":
              variant === "ghost",
            "text-[var(--color-primary)] underline-offset-4 hover:underline":
              variant === "link",
            "h-9 px-4 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-10 rounded-md px-8": size === "lg",
            "h-9 w-9": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
