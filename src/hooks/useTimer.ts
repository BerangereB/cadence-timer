import { useCallback, useEffect, useRef, useState } from "react"
import { claimAlert, playChime, pulse, resumeAudio, unlockAudio } from "@/lib/audio"
import { applySessionLink, commitPending } from "@/lib/link"
import {
  createExampleProgrammation,
  createProgrammation,
  createStep,
  mergeProgrammations,
  parseProgrammationFile,
  serializeProgrammations,
  type PendingImport,
  type Programmation,
  type Step,
} from "@/lib/programmation"

const noSteps: Step[] = []
import {
  advance,
  createSession,
  elapsedNow,
  pause,
  play,
  shiftStep,
  type Session,
} from "@/lib/session"
import {
  loadPending,
  loadProgrammations,
  loadSession,
  loadSettings,
  savePending,
  saveProgrammations,
  saveSession,
  saveSettings,
  type Settings,
} from "@/lib/storage"

export type Banner = { id: number; kind: "warn" | "end"; text: string }

function currentHref(): string {
  if (typeof window === "undefined") return "https://cadence.local/"
  return window.location.href
}

const opened = applySessionLink({
  programmations: loadProgrammations(),
  settings: loadSettings(),
  session: loadSession(),
  pending: loadPending(),
  href: currentHref(),
})

function boot(): { session: Session; alert: { kind: "warn" | "end"; name: string; visit: number } | null } {
  const loaded = opened.session
  const programmations = opened.programmations
  const settings = opened.settings
  if (loaded.programmationId && !programmations.some((item) => item.id === loaded.programmationId)) {
    return { session: createSession(programmations[0]?.id ?? null), alert: null }
  }
  const steps = programmations.find((item) => item.id === loaded.programmationId)?.steps ?? []
  const result = advance(loaded, steps, Date.now(), {
    warnAtPercent: settings.warnAtPercent,
    autoAdvance: settings.autoAdvance,
  })
  return {
    session: result.session,
    alert: result.alert && result.alertStepName
      ? { kind: result.alert, name: result.alertStepName, visit: result.session.visit }
      : null,
  }
}

const initialBoot = boot()

export function useTimer() {
  const [programmations, setProgrammations] = useState<Programmation[]>(opened.programmations)
  const [settings, setSettings] = useState<Settings>(opened.settings)
  const [session, setSession] = useState<Session>(initialBoot.session)
  const [pending, setPending] = useState<PendingImport | null>(opened.pending)
  const [now, setNow] = useState(() => Date.now())
  const [banner, setBanner] = useState<Banner | null>(null)
  const [notice, setNotice] = useState(opened.error ?? "")
  const [settingsOpen, setSettingsOpen] = useState(false)

  const settingsRef = useRef(settings)
  const sessionRef = useRef(session)
  const bootAlert = useRef(initialBoot.alert)
  const bannerId = useRef(0)

  const active = programmations.find((item) => item.id === session.programmationId) ?? null
  const steps = active?.steps ?? noSteps
  const step = steps[session.stepIndex] ?? null
  const rawElapsed = step ? elapsedNow(session, now) : 0
  const elapsed = step ? Math.min(rawElapsed, step.durationMs) : 0
  const remainingMs = step ? Math.max(0, step.durationMs - rawElapsed) : 0
  const progress = step ? Math.min(1, rawElapsed / step.durationMs) : 0
  const totalMs = steps.reduce((sum, item) => sum + item.durationMs, 0)
  const elapsedTotalMs = steps.slice(0, session.stepIndex).reduce((sum, item) => sum + item.durationMs, 0) + elapsed
  const busy = session.status === "running" || session.status === "paused"

  const fire = useCallback((kind: "warn" | "end", name: string, visit: number) => {
    const current = settingsRef.current
    if (!claimAlert(`${sessionRef.current.programmationId}:${visit}:${kind}`)) return
    bannerId.current += 1
    setBanner({
      id: bannerId.current,
      kind,
      text: kind === "warn" ? `Bientôt la fin · ${name}` : `Étape terminée · ${name}`,
    })
    if (current.soundEnabled) playChime(kind)
    pulse(kind)
    if (
      document.hidden &&
      current.notifySystem &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      new Notification(kind === "warn" ? "Bientôt la fin" : "Étape terminée", {
        body: name,
        silent: true,
        tag: "cadence",
      })
    }
  }, [])

  useEffect(() => {
    settingsRef.current = settings
    sessionRef.current = session
  })

  useEffect(() => {
    if (!bootAlert.current) return
    const alert = bootAlert.current
    bootAlert.current = null
    fire(alert.kind, alert.name, alert.visit)
  }, [fire])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])
  useEffect(() => {
    saveProgrammations(programmations)
  }, [programmations])
  useEffect(() => {
    saveSession(session)
  }, [session])
  useEffect(() => {
    savePending(pending)
  }, [pending])

  useEffect(() => {
    if (session.status !== "running") return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [session.status])

  useEffect(() => {
    const onVis = () => {
      setNow(Date.now())
      if (!document.hidden) resumeAudio()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])

  useEffect(() => {
    if (session.status !== "running") return
    const result = advance(session, steps, now, {
      warnAtPercent: settings.warnAtPercent,
      autoAdvance: settings.autoAdvance,
    })
    if (result.alert && result.alertStepName) fire(result.alert, result.alertStepName, result.session.visit)
    if (result.session !== session) setSession(result.session)
  }, [now, session, steps, settings.warnAtPercent, settings.autoAdvance, fire])

  const acceptProgrammations = useCallback((items: Programmation[], selectId: string | null, label: string) => {
    const status = sessionRef.current.status
    if (status === "running" || status === "paused") {
      setPending({ programmations: items, selectId, label })
      return false
    }
    setProgrammations((current) => mergeProgrammations(current, items))
    if (selectId) setSession(createSession(selectId))
    setPending(null)
    return true
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (event.code !== "Space") return
      event.preventDefault()
      const current = sessionRef.current
      const currentSteps = programmations.find((item) => item.id === current.programmationId)?.steps ?? []
      const stamp = Date.now()
      unlockAudio()
      setNow(stamp)
      setSession(current.status === "running" ? pause(current, stamp) : play(current, currentSteps, stamp))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [programmations])

  const dismissBanner = useCallback((id: number) => {
    setBanner((current) => (current?.id === id ? null : current))
  }, [])

  function patchSettings(patch: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...patch }))
  }

  function addStep() {
    const id = session.programmationId
    const exists = Boolean(id && programmations.some((item) => item.id === id))
    if (!exists) {
      const created = createProgrammation("Ma séance", [createStep()])
      setProgrammations((current) => [...current, created])
      setSession(createSession(created.id))
      return
    }
    setProgrammations((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, updatedAt: new Date().toISOString(), steps: [...item.steps, createStep()] }
          : item,
      ),
    )
  }

  return {
    programmations,
    settings,
    session,
    pending,
    banner,
    notice,
    settingsOpen,
    setSettingsOpen,
    active,
    steps,
    step,
    remainingMs,
    progress,
    totalMs,
    elapsedTotalMs,
    busy,
    dismissBanner,
    patchSettings,
    play: () => {
      const stamp = Date.now()
      unlockAudio()
      setNow(stamp)
      setSession((current) => play(current, steps, stamp))
    },
    pause: () => {
      const stamp = Date.now()
      unlockAudio()
      setNow(stamp)
      setSession((current) => pause(current, stamp))
    },
    reset: () => {
      if (pending) {
        const next = commitPending(programmations, session, settings, pending)
        setProgrammations(next.programmations)
        setSettings(next.settings)
        setSession(next.session)
        setPending(null)
        return
      }
      setSession(createSession(session.programmationId))
    },
    next: () => {
      const stamp = Date.now()
      setNow(stamp)
      setSession((current) => shiftStep(current, steps.length, 1, stamp))
    },
    prev: () => {
      const stamp = Date.now()
      setNow(stamp)
      setSession((current) => shiftStep(current, steps.length, -1, stamp))
    },
    selectProgrammation: (id: string) => {
      if (busy) return
      setSession(createSession(id))
    },
    newProgrammation: () => {
      if (busy) return
      const created = createProgrammation("Nouvelle séance")
      setProgrammations((current) => [...current, created])
      setSession(createSession(created.id))
    },
    rename: (name: string) => {
      setProgrammations((current) =>
        current.map((item) =>
          item.id === session.programmationId ? { ...item, name, updatedAt: new Date().toISOString() } : item,
        ),
      )
    },
    addStep,
    updateStep: (stepId: string, patch: Partial<Step>) => {
      setProgrammations((current) =>
        current.map((item) =>
          item.id !== session.programmationId
            ? item
            : {
                ...item,
                updatedAt: new Date().toISOString(),
                steps: item.steps.map((entry) => (entry.id === stepId ? { ...entry, ...patch } : entry)),
              },
        ),
      )
    },
    moveStep: (index: number, direction: -1 | 1) => {
      const target = index + direction
      if (target < 0 || target >= steps.length) return
      setProgrammations((current) =>
        current.map((item) => {
          if (item.id !== session.programmationId) return item
          const next = [...item.steps]
          const [moved] = next.splice(index, 1)
          if (!moved) return item
          next.splice(target, 0, moved)
          return { ...item, steps: next, updatedAt: new Date().toISOString() }
        }),
      )
      setSession((current) => {
        if (current.stepIndex === index) return { ...current, stepIndex: target }
        if (current.stepIndex === target) return { ...current, stepIndex: index }
        return current
      })
    },
    removeStep: (stepId: string) => {
      const index = steps.findIndex((item) => item.id === stepId)
      setProgrammations((current) =>
        current.map((item) =>
          item.id !== session.programmationId
            ? item
            : { ...item, updatedAt: new Date().toISOString(), steps: item.steps.filter((entry) => entry.id !== stepId) },
        ),
      )
      if (index < 0) return
      setSession((current) => {
        if (index === current.stepIndex) {
          return { ...createSession(current.programmationId), stepIndex: Math.max(0, index - 1) }
        }
        if (index < current.stepIndex) return { ...current, stepIndex: current.stepIndex - 1 }
        return current
      })
    },
    deleteProgrammation: () => {
      if (busy) return
      const remaining = programmations.filter((item) => item.id !== session.programmationId)
      setProgrammations(remaining)
      setSession(createSession(remaining[0]?.id ?? null))
    },
    loadExample: () => {
      const example = createExampleProgrammation()
      acceptProgrammations([example], example.id, example.name)
    },
    exportFile: () => {
      if (programmations.length === 0) return
      const blob = new Blob([serializeProgrammations(programmations)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "cadence-programmations.json"
      link.click()
      URL.revokeObjectURL(url)
    },
    importFile: async (file: File) => {
      try {
        const data: unknown = JSON.parse(await file.text())
        const items = parseProgrammationFile(data)
        if (acceptProgrammations(items, null, "Fichier")) setNotice("")
      } catch (error) {
        if (error instanceof SyntaxError) {
          setNotice("Ce fichier n’est pas un JSON valide.")
          return
        }
        setNotice(error instanceof Error ? error.message : "Import impossible.")
      }
    },
  }
}
