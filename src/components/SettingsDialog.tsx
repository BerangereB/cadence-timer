import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import type { Settings } from "@/lib/storage"

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

export function SettingsDialog({ open, onOpenChange, settings, onChange }: SettingsDialogProps) {
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
          <DialogDescription>Le seuil et le son restent dans ce navigateur.</DialogDescription>
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
              <p className="mt-1 text-sm text-muted-foreground">Le bandeau dans la page reste le signal fiable.</p>
            </div>
            <Switch id="systeme" checked={settings.notifySystem} onCheckedChange={(checked) => void onNotify(checked)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="enchainement">Enchaîner les étapes</Label>
            <Switch id="enchainement" checked={settings.autoAdvance} onCheckedChange={(checked) => onChange({ autoAdvance: checked })} />
          </div>

          <p className="text-sm text-muted-foreground">Un lien peut remplacer ces réglages à l’ouverture.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
