"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const DIALOG_MOTION_CLASS =
  "duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
const CALENDAR_FOCUS_ROOT_SELECTOR = "[data-calendar-focus-root]"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40",
        DIALOG_MOTION_CLASS,
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  anchorPoint: _anchorPoint,
  desktopPlacement: _desktopPlacement = "bottom-start",
  mobileMode = "center",
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  anchorPoint?: { x: number; y: number }
  desktopPlacement?: "bottom-start" | "bottom-end" | "right-start"
  mobileMode?: "sheet" | "center"
}) {
  const [isMobileViewport, setIsMobileViewport] = React.useState(false)
  const [calendarCenter, setCalendarCenter] = React.useState<{
    x: number
    y: number
  } | null>(null)
  void _anchorPoint
  void _desktopPlacement

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mediaQuery = window.matchMedia("(max-width: 639px)")
    const onViewportChange = () => setIsMobileViewport(mediaQuery.matches)
    onViewportChange()
    mediaQuery.addEventListener("change", onViewportChange)
    return () => mediaQuery.removeEventListener("change", onViewportChange)
  }, [])

  const shouldUseMobileSheet = isMobileViewport && mobileMode === "sheet"
  const updateCalendarCenter = React.useCallback(() => {
    if (typeof window === "undefined") return
    const target = document.querySelector<HTMLElement>(CALENDAR_FOCUS_ROOT_SELECTOR)
    if (!target) {
      setCalendarCenter(null)
      return
    }
    const rect = target.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      setCalendarCenter(null)
      return
    }
    setCalendarCenter({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }, [])

  React.useEffect(() => {
    if (shouldUseMobileSheet) return
    updateCalendarCenter()
    const onViewportChange = () => updateCalendarCenter()
    window.addEventListener("resize", onViewportChange)
    window.addEventListener("scroll", onViewportChange, true)
    return () => {
      window.removeEventListener("resize", onViewportChange)
      window.removeEventListener("scroll", onViewportChange, true)
    }
  }, [shouldUseMobileSheet, updateCalendarCenter])

  const desktopStyle =
    !shouldUseMobileSheet && calendarCenter
      ? {
          ...(style ?? {}),
          left: `${calendarCenter.x}px`,
          top: `${calendarCenter.y}px`,
        }
      : style

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed z-50 grid gap-4 border shadow-lg outline-none",
          DIALOG_MOTION_CLASS,
          shouldUseMobileSheet
            ? "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4 top-auto right-auto bottom-3 left-1/2 max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] translate-x-[-50%] translate-y-0 rounded-2xl p-4"
              : "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 top-[50%] left-[50%] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-lg p-6 sm:max-w-lg",
          className
        )}
        style={desktopStyle}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
