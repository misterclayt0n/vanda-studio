import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]",
          "hover:shadow-[0_2px_4px_rgba(0,0,0,0.15),0_8px_24px_var(--glow-pink)]",
          "hover:brightness-110",
          "active:scale-[0.97] active:shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
        ].join(" "),
        destructive: [
          "bg-destructive text-white",
          "shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]",
          "hover:shadow-[0_2px_4px_rgba(0,0,0,0.15),0_8px_24px_rgba(239,68,68,0.3)]",
          "hover:brightness-110",
          "active:scale-[0.97]",
        ].join(" "),
        outline: [
          "border-2 border-border bg-background/50 backdrop-blur-sm",
          "shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
          "hover:border-primary/60 hover:bg-primary/5 hover:text-primary",
          "hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
          "active:scale-[0.97] active:bg-primary/10",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground",
          "border border-border/50",
          "shadow-[0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.5)]",
          "hover:bg-secondary/80 hover:shadow-[0_2px_6px_rgba(0,0,0,0.08)]",
          "active:scale-[0.97]",
        ].join(" "),
        ghost: [
          "border border-transparent",
          "hover:bg-accent/80 hover:text-accent-foreground",
          "hover:border-border/50 hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
          "active:bg-accent active:scale-[0.97]",
        ].join(" "),
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
        gradient: [
          "bg-gradient-pink text-white",
          "shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_24px_var(--glow-pink),inset_0_1px_0_rgba(255,255,255,0.2)]",
          "hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_32px_var(--glow-pink)]",
          "hover:brightness-110",
          "active:scale-[0.97]",
        ].join(" "),
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-13 rounded-xl px-8 text-base",
        icon: "size-11 rounded-xl",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-13 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
