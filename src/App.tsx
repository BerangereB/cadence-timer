import { useRef, useState } from "react"
import { Download, Plus, Settings, Upload } from "lucide-react"
import { AlertBanner } from "@/components/AlertBanner"
import { SettingsDialog } from "@/components/SettingsDialog"
import { StepList } from "@/components/StepList"
import { TimerFace } from "@/components/TimerFace"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toaster } from "@/components/ui/sonner"
import { useTimer } from "@/hooks/useTimer"
import { cn } from "@/lib/utils"

function useEmbed() {
  const [embed] = useState(() => {
    try {
      return window.self !== window.top
    } catch {
      return true
    }
  })
  return embed
}

export default function App() {
  const timer = useTimer()
  const embed = useEmbed()
  const fileRef = useRef<HTMLInputElement>(null)
  const steps = timer.steps

  return (
    <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-8", embed ? "min-h-0 py-3" : "min-h-dvh")}>
      <AlertBanner banner={timer.banner} onDone={timer.dismissBanner} />
      <Toaster />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-clock text-4xl leading-none">Cadence</p>
          <p className="mt-1 text-sm text-muted-foreground">Minuteur de séance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {timer.programmations.length > 0 ? (
            <Select value={timer.session.programmationId ?? undefined} onValueChange={timer.selectProgrammation} disabled={timer.busy}>
              <SelectTrigger className="h-11 w-full sm:w-56" aria-label="Programmation">
                <SelectValue placeholder="Séance" />
              </SelectTrigger>
              <SelectContent>
                {timer.programmations.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name || "Séance"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button type="button" variant="outline" className="h-11" onClick={timer.newProgrammation} disabled={timer.busy}>
            Nouvelle
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={timer.exportFile} disabled={timer.programmations.length === 0}>
            <Download />
            Exporter
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => fileRef.current?.click()}>
            <Upload />
            Importer
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => timer.setSettingsOpen(true)}>
            <Settings />
            Réglages
          </Button>
          <input
            ref={fileRef}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void timer.importFile(file)
            }}
          />
        </div>
      </header>

      {timer.pending ? (
        <p className="rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-border" role="status">
          Programmation « {timer.pending.label} » reçue. Elle s’appliquera à la prochaine remise à zéro.
        </p>
      ) : null}
      {timer.notionStatus.state !== "idle" && !timer.settingsOpen ? (
        <p className={timer.notionStatus.state === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"} role={timer.notionStatus.state === "error" ? "alert" : "status"}>
          {timer.notionStatus.message}
        </p>
      ) : null}

      {steps.length === 0 ? (
        <section className="rounded-3xl bg-card px-5 py-10 text-center shadow-sm ring-1 ring-foreground/8 sm:px-10">
          <h1 className="font-clock text-4xl font-light">Aucune étape pour l’instant</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Découpez la séance en étapes nommées, importez un fichier JSON, ou récupérez une page Notion.
          </p>
          {timer.active ? (
            <Input
              className="mx-auto mt-6 h-11 max-w-sm"
              aria-label="Nom de la séance"
              value={timer.active.name}
              onChange={(event) => timer.rename(event.target.value)}
            />
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button type="button" className="h-11" onClick={timer.addStep}>
              <Plus />
              Ajouter une étape
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={timer.loadExample}>
              Charger un exemple
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => fileRef.current?.click()}>
              Importer un fichier
            </Button>
          </div>
          {timer.active ? (
            <Button type="button" variant="ghost" className="mt-4 h-11" disabled={timer.busy} onClick={timer.deleteProgrammation}>
              Supprimer la séance
            </Button>
          ) : null}
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <TimerFace
            embed={embed}
            status={timer.session.status}
            stepName={timer.step?.name ?? "Étape"}
            note={timer.step?.note}
            stepIndex={timer.session.stepIndex}
            stepCount={steps.length}
            remainingMs={timer.remainingMs}
            progress={timer.progress}
            elapsedTotalMs={timer.elapsedTotalMs}
            totalMs={timer.totalMs}
            attention={timer.banner?.kind ?? null}
            onPlay={timer.play}
            onPause={timer.pause}
            onPrev={timer.prev}
            onNext={timer.next}
            onReset={timer.reset}
          />
          <StepList
            name={timer.active?.name ?? ""}
            steps={steps}
            activeIndex={timer.session.stepIndex}
            busy={timer.busy}
            onRename={timer.rename}
            onAdd={timer.addStep}
            onUpdate={timer.updateStep}
            onMove={timer.moveStep}
            onRemove={timer.removeStep}
            onDeleteProgrammation={timer.deleteProgrammation}
          />
        </div>
      )}

      <SettingsDialog
        open={timer.settingsOpen}
        onOpenChange={timer.setSettingsOpen}
        settings={timer.settings}
        notionStatus={timer.notionStatus}
        pageParam={timer.pageParam}
        onChange={timer.patchSettings}
        onImport={() => void timer.runImport(timer.pageParam || timer.settings.notionPageUrl)}
      />
    </div>
  )
}
