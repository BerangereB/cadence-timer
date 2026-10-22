import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import type { NotionStatus } from "@/hooks/useTimer"
import type { Settings } from "@/lib/storage"

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  notionStatus: NotionStatus
  pageParam: string
  onChange: (patch: Partial<Settings>) => void
  onImport: () => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  notionStatus,
  pageParam,
  onChange,
  onImport,
}: SettingsDialogProps) {
  const [showToken, setShowToken] = useState(false)

  async function onNotify(checked: boolean) {
    if (!checked) {
      onChange({ notifySystem: false })
      return
    }
    if (typeof Notification === "undefined") return
    const permission = await Notification.requestPermission()
    onChange({ notifySystem: permission === "granted" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(85vh,760px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Réglages</DialogTitle>
          <DialogDescription>
            Le seuil, le son et la page Notion restent dans ce navigateur.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div>
            <Label htmlFor="seuil">Alerte à {settings.warnAtPercent} % de l’étape</Label>
            <Slider
              id="seuil"
              className="mt-3"
              min={50}
              max={95}
              step={1}
              value={[settings.warnAtPercent]}
              onValueChange={(value) => onChange({ warnAtPercent: value[0] ?? 80 })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="son">Son discret</Label>
            <Switch id="son" checked={settings.soundEnabled} onCheckedChange={(checked) => onChange({ soundEnabled: checked })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="systeme">Notification si l’onglet est masqué</Label>
              <p className="mt-1 text-sm text-muted-foreground">Dans Notion, le bandeau de la page reste le signal fiable.</p>
            </div>
            <Switch id="systeme" checked={settings.notifySystem} onCheckedChange={(checked) => void onNotify(checked)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="enchainement">Enchaîner les étapes</Label>
            <Switch id="enchainement" checked={settings.autoAdvance} onCheckedChange={(checked) => onChange({ autoAdvance: checked })} />
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-col gap-2">
            <Label htmlFor="jeton">Jeton d’intégration Notion</Label>
            <div className="flex gap-2">
              <Input
                id="jeton"
                className="h-10"
                type={showToken ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                value={settings.notionToken}
                onChange={(event) => onChange({ notionToken: event.target.value })}
              />
              <Button type="button" variant="outline" className="h-10" onClick={() => setShowToken((value) => !value)}>
                {showToken ? "Masquer" : "Voir"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Créez une intégration interne, partagez-lui la page, puis collez le jeton ici. Il n’est pas envoyé ailleurs que vers Notion.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="page">Page Notion</Label>
            <Input
              id="page"
              className="h-10"
              placeholder="https://www.notion.so/…"
              value={settings.notionPageUrl}
              onChange={(event) => onChange({ notionPageUrl: event.target.value })}
            />
            {pageParam ? <p className="text-sm text-muted-foreground">Cette ouverture demande la page {pageParam}.</p> : null}
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="auto">Importer à l’ouverture</Label>
            <Switch id="auto" checked={settings.autoImport} onCheckedChange={(checked) => onChange({ autoImport: checked })} />
          </div>

          <p className="text-sm text-muted-foreground">
            Liste : « 25 min — Travail profond ». Base : titre de la ligne, colonne nombre Durée (minutes), ordre facultatif.
          </p>

          {notionStatus.state !== "idle" ? (
            <p className={notionStatus.state === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"} role={notionStatus.state === "error" ? "alert" : "status"}>
              {notionStatus.message}
            </p>
          ) : null}

          <Button type="button" className="h-11" onClick={onImport} disabled={notionStatus.state === "loading"}>
            {notionStatus.state === "loading" ? "Lecture…" : "Importer maintenant"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
