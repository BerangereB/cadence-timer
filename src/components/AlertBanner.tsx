import { useEffect } from "react"
import type { Banner } from "@/hooks/useTimer"
import { cn } from "@/lib/utils"

export function AlertBanner({ banner, onDone }: { banner: Banner | null; onDone: (id: number) => void }) {
  useEffect(() => {
    if (!banner) return
    const delay = banner.kind === "warn" ? 4200 : 5200
    const id = window.setTimeout(() => onDone(banner.id), delay)
    return () => window.clearTimeout(id)
  }, [banner, onDone])

  if (!banner) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3" role="status" aria-live="polite">
      <p
        className={cn(
          "rounded-full px-4 py-2 text-sm shadow-sm",
          banner.kind === "end" ? "bg-primary text-primary-foreground" : "bg-card text-foreground ring-1 ring-border",
        )}
      >
        {banner.text}
      </p>
    </div>
  )
}
