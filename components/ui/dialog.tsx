"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const DIALOG_MOTION_CLASS =
  "duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
const DIALOG_EDGE_MARGIN = 12
const DIALOG_ANCHOR_OFFSET = 8

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
  anchorPoint,
  desktopPlacement = "bottom-start",
  mobileMode = "center",
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  anchorPoint?: { x: number; y: number }
  desktopPlacement?: "bottom-start" | "bottom-end" | "right-start"
  mobileMode?: "sheet" | "center"
}) {
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [isMobileViewport, setIsMobileViewport] = React.useState(false)
  const [anchoredPosition, setAnchoredPosition] = React.useState<{
    top: number
    left: number
  } | null>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mediaQuery = window.matchMedia("(max-width: 639px)")
    const onViewportChange = () => setIsMobileViewport(mediaQuery.matches)
    onViewportChange()
    mediaQuery.addEventListener("change", onViewportChange)
    return () => mediaQuery.removeEventListener("change", onViewportChange)
  }, [])

  const shouldUseAnchoredDesktop = Boolean(anchorPoint) && !isMobileViewport
  const shouldUseMobileSheet = isMobileViewport && mobileMode === "sheet"

  const resolveAnchoredPosition = React.useCallback(() => {
    if (
      typeof window === "undefined" ||
      !anchorPoint ||
      !shouldUseAnchoredDesktop ||
      !contentRef.current
    ) {
      setAnchoredPosition(null)
      return
    }

    const node = contentRef.current
    const width = node.offsetWidth
    const height = node.offsetHeight
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let left = anchorPoint.x
    let top = anchorPoint.y

    if (desktopPlacement === "right-start") {
      left = anchorPoint.x + DIALOG_ANCHOR_OFFSET
      top = anchorPoint.y
      if (left + width > viewportWidth - DIALOG_EDGE_MARGIN) {
        left = anchorPoint.x - width - DIALOG_ANCHOR_OFFSET
      }
    } else if (desktopPlacement === "bottom-end") {
      left = anchorPoint.x - width
      top = anchorPoint.y + DIALOG_ANCHOR_OFFSET
      if (top + height > viewportHeight - DIALOG_EDGE_MARGIN) {
        top = anchorPoint.y - height - DIALOG_ANCHOR_OFFSET
      }
    } else {
      left = anchorPoint.x
      top = anchorPoint.y + DIALOG_ANCHOR_OFFSET
      if (top + height > viewportHeight - DIALOG_EDGE_MARGIN) {
        top = anchorPoint.y - height - DIALOG_ANCHOR_OFFSET
      }
    }

    left = Math.max(
      DIALOG_EDGE_MARGIN,
      Math.min(left, viewportWidth - width - DIALOG_EDGE_MARGIN)
    )
    top = Math.max(
      DIALOG_EDGE_MARGIN,
      Math.min(top, viewportHeight - height - DIALOG_EDGE_MARGIN)
    )

    setAnchoredPosition({ top: Math.round(top), left: Math.round(left) })
  }, [anchorPoint, desktopPlacement, shouldUseAnchoredDesktop])

  React.useLayoutEffect(() => {
    if (!shouldUseAnchoredDesktop) {
      setAnchoredPosition(null)
      return
    }

    const frameId = window.requestAnimationFrame(resolveAnchoredPosition)
    const onReposition = () => resolveAnchoredPosition()

    window.addEventListener("resize", onReposition)
    window.addEventListener("scroll", onReposition, true)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", onReposition)
      window.removeEventListener("scroll", onReposition, true)
    }
  }, [resolveAnchoredPosition, shouldUseAnchoredDesktop])

  const isAnchoringPending = shouldUseAnchoredDesktop && !anchoredPosition
  const resolvedStyle =
    shouldUseAnchoredDesktop && anchoredPosition
      ? {
          ...style,
          top: `${anchoredPosition.top}px`,
          left: `${anchoredPosition.left}px`,
        }
      : style

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed z-50 grid gap-4 border shadow-lg outline-none",
          DIALOG_MOTION_CLASS,
          shouldUseMobileSheet
            ? "data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4 top-auto right-auto bottom-3 left-1/2 max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] translate-x-[-50%] translate-y-0 rounded-2xl p-4"
            : shouldUseAnchoredDesktop
              ? "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 top-0 left-0 w-full max-w-[calc(100%-1.5rem)] translate-x-0 translate-y-0 rounded-xl p-5 sm:max-w-lg"
              : "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 top-[50%] left-[50%] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-lg p-6 sm:max-w-lg",
          isAnchoringPending ? "opacity-0" : "",
          className
        )}
        style={resolvedStyle}
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
