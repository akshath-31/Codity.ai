import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Brutalist button bases
    const baseClasses = "inline-flex items-center justify-center font-bold border-2 border-black rounded-brutal transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-brutal-hover disabled:opacity-50 disabled:pointer-events-none"
    
    // Size variants
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-8 text-lg",
      icon: "h-10 w-10",
    }
    
    // Color variants
    const variantClasses = {
      default: "bg-primary text-white shadow-brutal",
      secondary: "bg-accent1 text-black shadow-brutal",
      destructive: "bg-status-failed text-white shadow-brutal",
      outline: "bg-white text-black shadow-brutal",
      ghost: "border-transparent bg-transparent hover:bg-black/5 active:translate-x-0 active:translate-y-0 active:shadow-none hover:translate-x-0 hover:translate-y-0 hover:shadow-none",
    }

    return (
      <Comp
        className={cn(
          baseClasses,
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
