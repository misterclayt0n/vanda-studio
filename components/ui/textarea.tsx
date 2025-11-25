import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground",
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm px-3 py-2 text-base shadow-sm",
        "transition-all duration-200 outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "hover:border-primary/30 hover:bg-background/80",
        "focus-visible:border-primary/50 focus-visible:ring-primary/20 focus-visible:ring-[3px] focus-visible:bg-background/80",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
