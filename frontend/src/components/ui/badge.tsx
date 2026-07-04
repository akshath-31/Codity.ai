import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: "default" | "success" | "completed" | "running" | "in_progress" | "failed" | "dead_letter" | "queued" | "pending" | "paused"
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, status = "default", ...props }, ref) => {
    
    const getStatusColor = (status: BadgeProps["status"]) => {
      switch (status) {
        case "success":
        case "completed":
          return "bg-status-success text-white"
        case "running":
        case "in_progress":
          return "bg-status-running text-black"
        case "failed":
        case "dead_letter":
          return "bg-status-failed text-white"
        case "queued":
        case "pending":
          return "bg-status-queued text-white"
        case "paused":
          return "bg-status-paused text-black"
        default:
          return "bg-black text-white"
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-brutal border-2 border-black px-2.5 py-0.5 text-xs font-bold uppercase shadow-brutal-sm transition-colors",
          getStatusColor(status),
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
