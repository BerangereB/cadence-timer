import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { clampDuration, formatClock } from "@/lib/duration"
import type { Step } from "@/lib/programmation"
import { cn } from "@/lib/utils"

type StepListProps = {
  name: string
  steps: Step[]
  activeIndex: number
  busy: boolean
  onRename: (name: string) => void
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<Step>) => void
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (id: string) => void
  onDeleteProgrammation: () => void
}

export function StepList(props: StepListProps) {
  return (
    <section className="rounded-3xl bg-card p-4 shadow-sm ring-1 ring-foreground/8 sm:p-5">
      <label className="text-xs tracking-[0.16em] text-muted-foreground uppercase" htmlFor="programmation-name">
        Programmation
      </label>
      <Input
        id="programmation-name"
        className="mt-2 h-10"
        value={props.name}
        onChange={(event) => props.onRename(event.target.value)}
      />
      <ol className="mt-4 flex flex-col gap-3">
        {props.steps.map((step, index) => {
          const minutes = Math.floor(step.durationMs / 60_000)
          const seconds = Math.round((step.durationMs % 60_000) / 1000)
          return (
            <li
              key={step.id}
              className={cn(
                "rounded-2xl border p-3",
                index === props.activeIndex ? "border-primary/40 bg-primary/5" : "border-border",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 text-sm text-muted-foreground tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                <Input
                  aria-label={`Nom de l’étape ${index + 1}`}
                  className="h-10"
                  value={step.name}
                  onChange={(event) => props.onUpdate(step.id, { name: event.target.value })}
                  onBlur={(event) => {
                    if (!event.target.value.trim()) props.onUpdate(step.id, { name: "Étape" })
                  }}
                />
                <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Supprimer l’étape" onClick={() => props.onRemove(step.id)}>
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
                <Input
                  aria-label="Minutes"
                  className="h-10 w-16 text-center tabular-nums"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={minutes}
                  onChange={(event) => props.onUpdate(step.id, { durationMs: clampDuration(Number(event.target.value), seconds) })}
                />
                <span className="text-sm text-muted-foreground">min</span>
                <Input
                  aria-label="Secondes"
                  className="h-10 w-16 text-center tabular-nums"
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={seconds}
                  onChange={(event) => props.onUpdate(step.id, { durationMs: clampDuration(minutes, Number(event.target.value)) })}
                />
                <span className="text-sm text-muted-foreground">s</span>
                <span className="ml-auto text-sm text-muted-foreground tabular-nums">{formatClock(step.durationMs)}</span>
                <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Monter" disabled={index === 0} onClick={() => props.onMove(index, -1)}>
                  <ChevronUp />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Descendre" disabled={index === props.steps.length - 1} onClick={() => props.onMove(index, 1)}>
                  <ChevronDown />
                </Button>
              </div>
              <Input
                aria-label="Note"
                className="mt-2 ml-8 h-10 w-[calc(100%-2rem)]"
                placeholder="Note, facultative"
                value={step.note ?? ""}
                onChange={(event) => props.onUpdate(step.id, { note: event.target.value || undefined })}
              />
            </li>
          )
        })}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" className="h-11" onClick={props.onAdd}>
          <Plus />
          Ajouter une étape
        </Button>
        <Button type="button" variant="ghost" className="h-11" disabled={props.busy} onClick={props.onDeleteProgrammation}>
          Supprimer la séance
        </Button>
      </div>
    </section>
  )
}
