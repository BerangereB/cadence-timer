import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatClock, formatLoose, formatSpoken } from "@/lib/duration"
import { statusLabel, type SessionStatus } from "@/lib/session"
import { cn } from "@/lib/utils"

type TimerFaceProps = {
  embed: boolean
  status: SessionStatus
  stepName: string
  note?: string
  stepIndex: number
  stepCount: number
  remainingMs: number
  progress: number
  elapsedTotalMs: number
  totalMs: number
  attention: "warn" | "end" | null
  onPlay: () => void
  onPause: () => void
  onPrev: () => void
  onNext: () => void
  onReset: () => void
}

export function TimerFace({
  embed,
  status,
  stepName,
  note,
  stepIndex,
  stepCount,
  remainingMs,
  progress,
  elapsedTotalMs,
  totalMs,
  attention,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onReset,
}: TimerFaceProps) {
  const radius = 86
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)))
  const running = status === "running"

  return (
    <section className="flex flex-col items-center rounded-3xl bg-card px-4 py-6 shadow-sm ring-1 ring-foreground/8 sm:px-8 sm:py-8">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">{statusLabel(status)}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Étape {stepIndex + 1} sur {stepCount}
      </p>
      <h2 className="mt-1 max-w-full truncate text-center text-2xl font-medium">{stepName}</h2>
      {note ? <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">{note}</p> : null}

      <div className={cn("relative mt-6", embed ? "size-52" : "size-60 sm:size-64")} aria-hidden>
        <svg viewBox="0 0 200 200" className="size-full -rotate-90">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--muted)" strokeWidth="8" />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={attention === "end" ? "var(--primary)" : "var(--primary)"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            opacity={attention === "warn" ? 0.7 : 1}
          />
        </svg>
        <p
          className={cn(
            "absolute inset-0 flex items-center justify-center font-clock font-light tabular-nums tracking-tight",
            embed ? "text-5xl" : "text-6xl sm:text-7xl",
          )}
          aria-label={`Temps restant ${formatSpoken(remainingMs)}`}
        >
          {formatClock(remainingMs)}
        </p>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {formatLoose(elapsedTotalMs)} sur {formatLoose(totalMs)}
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button type="button" variant="outline" className="size-12 rounded-full" onClick={onPrev} disabled={stepIndex === 0} aria-label="Étape précédente">
          <SkipBack />
        </Button>
        <Button
          type="button"
          className="size-16 rounded-full"
          onClick={running ? onPause : onPlay}
          aria-label={running ? "Pause" : "Lecture"}
        >
          {running ? <Pause className="size-6" /> : <Play className="size-6 translate-x-0.5" />}
        </Button>
        <Button type="button" variant="outline" className="size-12 rounded-full" onClick={onNext} disabled={stepIndex >= stepCount - 1} aria-label="Étape suivante">
          <SkipForward />
        </Button>
      </div>
      <Button type="button" variant="ghost" className="mt-3 h-10" onClick={onReset}>
        <RotateCcw />
        Recommencer
      </Button>
    </section>
  )
}
