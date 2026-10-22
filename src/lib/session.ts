export type SessionStatus = "idle" | "running" | "paused" | "done"

export type Session = {
  programmationId: string | null
  stepIndex: number
  status: SessionStatus
  elapsedMs: number
  runStartedAt: number | null
  warned: boolean
  ended: boolean
  visit: number
}

export type AdvanceOptions = {
  warnAtPercent: number
  autoAdvance: boolean
}

export type AdvanceResult = {
  session: Session
  alert: "warn" | "end" | null
  alertStepName: string | null
}

type StepLike = { name: string; durationMs: number }

export function createSession(programmationId: string | null): Session {
  return {
    programmationId,
    stepIndex: 0,
    status: "idle",
    elapsedMs: 0,
    runStartedAt: null,
    warned: false,
    ended: false,
    visit: 0,
  }
}

export function elapsedNow(session: Session, now: number): number {
  if (session.status === "running" && session.runStartedAt != null) {
    return session.elapsedMs + Math.max(0, now - session.runStartedAt)
  }
  return session.elapsedMs
}

export function statusLabel(status: SessionStatus): string {
  if (status === "running") return "En cours"
  if (status === "paused") return "En pause"
  if (status === "done") return "Terminée"
  return "Prête"
}

function durationOf(step: StepLike | undefined): number {
  return Math.max(1, step?.durationMs ?? 1)
}

export function advance(session: Session, steps: StepLike[], now: number, opts: AdvanceOptions): AdvanceResult {
  if (session.status !== "running" || steps.length === 0) {
    return { session, alert: null, alertStepName: null }
  }

  let index = Math.min(Math.max(session.stepIndex, 0), steps.length - 1)
  let elapsed = elapsedNow(session, now)
  const warnRatio = opts.warnAtPercent / 100
  const completed: string[] = []

  while (index < steps.length) {
    const duration = durationOf(steps[index])
    if (elapsed < duration) break
    completed.push(steps[index]?.name || "Étape")
    const overflow = elapsed - duration
    const isLast = index === steps.length - 1
    if (!opts.autoAdvance || isLast) {
      return {
        session: {
          ...session,
          stepIndex: index,
          status: isLast ? "done" : "paused",
          elapsedMs: duration,
          runStartedAt: null,
          warned: true,
          ended: true,
        },
        alert: "end",
        alertStepName: completed.length === 1 ? completed[0] : `${completed.length} étapes terminées`,
      }
    }
    index += 1
    elapsed = overflow
  }

  if (completed.length > 0 && index < steps.length) {
    const duration = durationOf(steps[index])
    const ratio = elapsed / duration
    return {
      session: {
        ...session,
        stepIndex: index,
        status: "running",
        elapsedMs: elapsed,
        runStartedAt: now,
        warned: ratio >= warnRatio && ratio < 1,
        ended: false,
        visit: session.visit + 1,
      },
      alert: "end",
      alertStepName: completed.length === 1 ? completed[0] : `${completed.length} étapes terminées`,
    }
  }

  const duration = durationOf(steps[index])
  const ratio = elapsed / duration
  if (!session.warned && ratio >= warnRatio && ratio < 1) {
    return {
      session: { ...session, stepIndex: index, warned: true },
      alert: "warn",
      alertStepName: steps[index]?.name || "Étape",
    }
  }

  if (index !== session.stepIndex) {
    return { session: { ...session, stepIndex: index }, alert: null, alertStepName: null }
  }

  return { session, alert: null, alertStepName: null }
}

export function play(session: Session, steps: StepLike[], now: number): Session {
  if (steps.length === 0 || session.status === "running") return session
  const index = Math.min(Math.max(session.stepIndex, 0), steps.length - 1)
  const duration = durationOf(steps[index])
  if (session.status === "paused" && !session.ended && session.elapsedMs < duration) {
    return { ...session, status: "running", runStartedAt: now }
  }
  const restart = session.status === "done" || session.ended || index >= steps.length - 1 && session.ended
  const atBoundary = session.status === "done" || session.ended
  if (atBoundary) {
    const nextIndex = session.status === "done" || index >= steps.length - 1 ? 0 : index + 1
    return {
      ...session,
      stepIndex: restart ? nextIndex : index,
      status: "running",
      elapsedMs: 0,
      runStartedAt: now,
      warned: false,
      ended: false,
      visit: session.visit + 1,
    }
  }
  return {
    ...session,
    stepIndex: index,
    status: "running",
    runStartedAt: now,
    elapsedMs: session.status === "idle" ? 0 : session.elapsedMs,
  }
}

export function pause(session: Session, now: number): Session {
  if (session.status !== "running") return session
  return {
    ...session,
    status: "paused",
    elapsedMs: elapsedNow(session, now),
    runStartedAt: null,
  }
}

export function shiftStep(session: Session, stepCount: number, direction: -1 | 1, now: number): Session {
  if (stepCount === 0) return session
  const index = session.stepIndex + direction
  if (index < 0 || index >= stepCount) return session
  const running = session.status === "running"
  return {
    ...session,
    stepIndex: index,
    elapsedMs: 0,
    runStartedAt: running ? now : null,
    status: session.status === "done" ? "paused" : session.status,
    warned: false,
    ended: false,
    visit: session.visit + 1,
  }
}
