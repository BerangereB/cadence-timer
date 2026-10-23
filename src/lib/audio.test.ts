import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type FakeCtx = {
  state: string
  currentTime: number
  destination: object
  resume: ReturnType<typeof vi.fn>
  createBuffer: ReturnType<typeof vi.fn>
  createBufferSource: ReturnType<typeof vi.fn>
  createOscillator: ReturnType<typeof vi.fn>
  createGain: ReturnType<typeof vi.fn>
}

function installAudioMock(options?: { webkitOnly?: boolean }) {
  const bufferStart = vi.fn()
  const oscStart = vi.fn()
  const resume = vi.fn(() => Promise.resolve())
  const createBuffer = vi.fn(() => ({}))
  const createBufferSource = vi.fn(() => ({
    buffer: null as unknown,
    connect: vi.fn(),
    start: bufferStart,
  }))
  const createOscillator = vi.fn(() => ({
    type: "sine",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: oscStart,
    stop: vi.fn(),
  }))
  const createGain = vi.fn(() => ({
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  }))

  function FakeAudioContext(this: FakeCtx) {
    this.state = "suspended"
    this.currentTime = 0
    this.destination = {}
    this.resume = resume
    this.createBuffer = createBuffer
    this.createBufferSource = createBufferSource
    this.createOscillator = createOscillator
    this.createGain = createGain
  }

  const AudioContext = FakeAudioContext as unknown as typeof globalThis.AudioContext
  const host: {
    AudioContext?: typeof globalThis.AudioContext
    webkitAudioContext?: typeof globalThis.AudioContext
  } = { ...globalThis }
  if (options?.webkitOnly) {
    host.webkitAudioContext = AudioContext
  } else {
    host.AudioContext = AudioContext
  }
  vi.stubGlobal("window", host)

  return { bufferStart, oscStart, resume, createBuffer, createBufferSource, createOscillator }
}

describe("audio mobile", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("débloque avec resume et un buffer silencieux", async () => {
    const mock = installAudioMock()
    const { unlockAudio } = await import("./audio")
    unlockAudio()
    expect(mock.resume).toHaveBeenCalled()
    expect(mock.createBuffer).toHaveBeenCalled()
    expect(mock.createBufferSource).toHaveBeenCalled()
    expect(mock.bufferStart).toHaveBeenCalledWith(0)
  })

  it("accepte webkitAudioContext", async () => {
    const mock = installAudioMock({ webkitOnly: true })
    const { unlockAudio } = await import("./audio")
    unlockAudio()
    expect(mock.createBufferSource).toHaveBeenCalled()
  })

  it("relance resume avant un carillon si le contexte est suspendu", async () => {
    const mock = installAudioMock()
    const { unlockAudio, playChime } = await import("./audio")
    unlockAudio()
    mock.resume.mockClear()
    playChime("warn")
    expect(mock.resume).toHaveBeenCalled()
    expect(mock.oscStart).toHaveBeenCalled()
  })
})
