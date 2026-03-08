"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { AnchorPoint } from "@/lib/types"

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
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

const MOBILE_BREAKPOINT_PX = 768
const VIEWPORT_PADDING_PX = 8
const ANCHORED_OFFSET_PX = 8

const clampToViewport = (value: number, min: number, max: number) => {
  if (max <= min) return min
  return Math.min(Math.max(value, min), max)
}

const useIsMobileViewport = () => {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`)
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return isMobile
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  anchorPoint,
  desktopPlacement = "bottom-start",
  mobileMode = "center",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  anchorPoint?: AnchorPoint
  desktopPlacement?: "bottom-start" | "bottom-end" | "right-start"
  mobileMode?: "sheet" | "center"
}) {
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const isMobile = useIsMobileViewport()
  const isSheet = mobileMode === "sheet" && isMobile
  const isAnchoredDesktop = Boolean(anchorPoint) && !isMobile
  const anchoredOriginClass =
    desktopPlacement === "bottom-end" ? "origin-top-right" : "origin-top-left"
  const [anchoredStyle, setAnchoredStyle] = React.useState<React.CSSProperties | undefined>(
    undefined
  )
  const [isAnchoredPositionReady, setIsAnchoredPositionReady] = React.useState(false)

  const updateAnchoredPosition = React.useCallback(() => {
    if (!isAnchoredDesktop || !anchorPoint || !contentRef.current) {
      setAnchoredStyle(undefined)
      setIsAnchoredPositionReady(false)
      return
    }

    const rect = contentRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      setIsAnchoredPositionReady(false)
      return
    }

    let left = anchorPoint.x
    let top = anchorPoint.y + ANCHORED_OFFSET_PX

    if (desktopPlacement === "bottom-end") {
      left = anchorPoint.x - rect.width
    } else if (desktopPlacement === "right-start") {
      left = anchorPoint.x + ANCHORED_OFFSET_PX
      top = anchorPoint.y
    }

    const maxLeft = window.innerWidth - rect.width - VIEWPORT_PADDING_PX
    const maxTop = window.innerHeight - rect.height - VIEWPORT_PADDING_PX

    setAnchoredStyle({
      left: clampToViewport(left, VIEWPORT_PADDING_PX, maxLeft),
      top: clampToViewport(top, VIEWPORT_PADDING_PX, maxTop),
    })
    setIsAnchoredPositionReady(true)
  }, [anchorPoint, desktopPlacement, isAnchoredDesktop])

  React.useLayoutEffect(() => {
    if (!isAnchoredDesktop) {
      setAnchoredStyle(undefined)
      setIsAnchoredPositionReady(false)
      return
    }
    setIsAnchoredPositionReady(false)
    updateAnchoredPosition()
  }, [isAnchoredDesktop, updateAnchoredPosition])

  React.useEffect(() => {
    if (!isAnchoredDesktop) return
    const onLayoutChange = () => updateAnchoredPosition()
    window.addEventListener("resize", onLayoutChange)
    window.addEventListener("scroll", onLayoutChange, true)
    return () => {
      window.removeEventListener("resize", onLayoutChange)
      window.removeEventListener("scroll", onLayoutChange, true)
    }
  }, [isAnchoredDesktop, updateAnchoredPosition])

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed z-50 grid w-full gap-4 border shadow-lg outline-none",
          isSheet
            ? "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 inset-x-0 bottom-0 top-auto max-h-[85dvh] translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl rounded-b-none p-4 duration-200"
            : isAnchoredDesktop
              ? cn(
                  "top-0 left-0 max-w-[calc(100%-1rem)] rounded-lg p-6 sm:max-w-lg",
                  anchoredOriginClass,
                  "transition-[opacity,transform] duration-140 ease-out data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-[0.98]",
                  !isAnchoredPositionReady && "pointer-events-none opacity-0"
                )
              : "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 top-[50%] left-[50%] max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-lg p-6 sm:max-w-lg duration-200",
          className
        )}
        style={isAnchoredDesktop ? anchoredStyle : undefined}
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
