import type { App, TFile, WorkspaceLeaf } from "obsidian"
import type {
  DateSnapshot,
  EnginePatchRecord,
  GraphDataEngine,
  GraphNode,
  GraphRenderer,
  SpeedPatchRecord,
} from "./types"
import { isTFileLike, readGraphEngine } from "./types"

const FRAME_DELAY_MS = 0
const BASE_SPEED_FACTOR = 0.5
const MIN_PROGRESSION_SPEED = 5
const MAX_PROGRESSION_SPEED = 100

export class GraphEngineController {
  readonly #app: App
  readonly #prototypePatches: EnginePatchRecord[] = []
  readonly #speedPatches: SpeedPatchRecord[] = []
  #speedMultiplier: number

  constructor(app: App, speedMultiplier: number) {
    this.#app = app
    this.#speedMultiplier = speedMultiplier
  }

  setSpeedMultiplier(speedMultiplier: number): void {
    this.#speedMultiplier = clampNumber(speedMultiplier, 0.1, 10)
  }

  patchEngine(engine: GraphDataEngine): void {
    this.#patchRenderProgression(engine)
    this.#patchSpeed(engine)
  }

  patchLeaf(leaf: WorkspaceLeaf): GraphDataEngine | null {
    const engine = readGraphEngine(leaf)
    if (!engine) {
      return null
    }
    this.patchEngine(engine)
    return engine
  }

  play(engine: GraphDataEngine): void {
    engine._graphAnimationControllerPaused = false
    const resumeFrom = engine._graphAnimationControllerResumeFrom ?? (engine.progression > 0 ? engine.progression : undefined)
    if (resumeFrom !== undefined) {
      engine._graphAnimationControllerResumeFrom = resumeFrom
    }
    void engine.renderProgression()
  }

  replay(engine: GraphDataEngine): void {
    engine._graphAnimationControllerPaused = false
    engine._graphAnimationControllerResumeFrom = 1
    engine.progression = 1
    void engine.renderProgression()
  }

  pause(engine: GraphDataEngine): void {
    if (engine.progression > 0) {
      engine._graphAnimationControllerResumeFrom = engine.progression
    }
    engine._graphAnimationControllerPaused = true
  }

  seek(engine: GraphDataEngine, direction: -1 | 1, seekStepPercent: number): void {
    const wasPaused = engine._graphAnimationControllerPaused === true || engine.progression <= 0
    const maxProgression = this.#readMaxProgression(engine)
    const step = Math.max(1, Math.floor(maxProgression * (seekStepPercent / 100)))
    const current = engine.progression > 0 ? engine.progression : engine._graphAnimationControllerResumeFrom ?? 1
    const next = clampNumber(current + direction * step, 1, maxProgression)
    engine.progression = next
    engine._graphAnimationControllerResumeFrom = next
    engine.render()
    if (wasPaused) {
      engine._graphAnimationControllerPaused = true
      return
    }
    engine._graphAnimationControllerPaused = false
    void engine.renderProgression()
  }

  setProgressPercent(engine: GraphDataEngine, progressPercent: number): void {
    const wasPaused = engine._graphAnimationControllerPaused === true || engine.progression <= 0
    const maxProgression = this.#readMaxProgression(engine)
    const ratio = clampNumber(progressPercent, 0, 100) / 100
    const next = Math.max(1, Math.round(1 + (maxProgression - 1) * ratio))
    engine.progression = next
    engine._graphAnimationControllerResumeFrom = next
    engine.render()
    if (wasPaused) {
      engine._graphAnimationControllerPaused = true
      return
    }
    engine._graphAnimationControllerPaused = false
    void engine.renderProgression()
  }

  previewProgressPercent(engine: GraphDataEngine, progressPercent: number): void {
    const maxProgression = this.#readMaxProgression(engine)
    const ratio = clampNumber(progressPercent, 0, 100) / 100
    const next = Math.max(1, Math.round(1 + (maxProgression - 1) * ratio))
    engine.progression = next
    engine._graphAnimationControllerResumeFrom = next
    engine.render()
  }

  getDateSnapshot(engine: GraphDataEngine): DateSnapshot | null {
    const maxProgression = engine._graphAnimationControllerMaxProgression
    if (maxProgression === undefined) {
      return null
    }
    const nodes = engine.renderer.nodes
    if (nodes.length === 0) {
      return null
    }

    const progression = engine.progression > 0 ? engine.progression : engine._graphAnimationControllerResumeFrom ?? 1
    const ratio = clampNumber(progression, 1, maxProgression) / maxProgression
    const nodeIndex = Math.min(Math.floor(ratio * nodes.length), nodes.length - 1)
    const node = nodes[nodeIndex]
    if (!node) {
      return null
    }
    return this.#snapshotForNode(node, progressionPercent(progression, maxProgression))
  }

  unload(): void {
    for (const speedPatch of this.#speedPatches) {
      speedPatch.restore()
    }
    this.#speedPatches.length = 0

    for (const patch of this.#prototypePatches) {
      Object.defineProperty(patch.prototype, "renderProgression", {
        value: patch.originalRenderProgression,
        configurable: true,
        writable: true,
      })
    }
    this.#prototypePatches.length = 0
  }

  #snapshotForNode(node: GraphNode, progressPercent: number): DateSnapshot | null {
    const file = this.#app.vault.getAbstractFileByPath(node.id)
    if (!isTFileLike(file)) {
      return null
    }
    const timestamp = Math.min(file.stat.ctime, file.stat.mtime)
    return { file: file as TFile, timestamp, progressPercent }
  }

  #readMaxProgression(engine: GraphDataEngine): number {
    if (engine._graphAnimationControllerMaxProgression !== undefined) {
      return Math.max(1, engine._graphAnimationControllerMaxProgression)
    }
    const maxProgression = Math.max(1, engine.render())
    engine._graphAnimationControllerMaxProgression = maxProgression
    return maxProgression
  }

  #patchRenderProgression(engine: GraphDataEngine): void {
    const prototype = Object.getPrototypeOf(engine)
    if (this.#prototypePatches.some((patch) => patch.prototype === prototype)) {
      return
    }

    const originalRenderProgression = engine.renderProgression
    const controller = this
    Object.defineProperty(prototype, "renderProgression", {
      configurable: true,
      writable: true,
      value: async function renderProgression(this: GraphDataEngine): Promise<void> {
        this._graphAnimationControllerPaused = false
        const startFrom = this._graphAnimationControllerResumeFrom ?? 1
        this._graphAnimationControllerResumeFrom = undefined
        const maxProgression = Math.max(1, this.render())
        this._graphAnimationControllerMaxProgression = maxProgression
        this.progressionSpeed = clampNumber(
          BASE_SPEED_FACTOR * Math.sqrt(maxProgression),
          MIN_PROGRESSION_SPEED,
          MAX_PROGRESSION_SPEED,
        )
        this.progression = clampNumber(startFrom, 1, maxProgression)

        const elapsedOffset = ((this.progression - 1) / this.progressionSpeed) * 1000
        const startedAt = Date.now() - elapsedOffset

        while (this.progression > 0) {
          const oldProgression = this.progression
          await new Promise<void>((resolve) => window.setTimeout(resolve, FRAME_DELAY_MS))
          if (Boolean(this._graphAnimationControllerPaused)) {
            this._graphAnimationControllerResumeFrom = oldProgression
            this.progression = oldProgression
            break
          }
          if (oldProgression !== this.progression) {
            break
          }

          const next = 1 + Math.floor((this.progressionSpeed * (Date.now() - startedAt)) / 1000)
          if (next === this.progression) {
            continue
          }
          this.progression = next
          if (!this.render()) {
            break
          }
        }
      },
    })
    controller.#prototypePatches.push({ prototype, originalRenderProgression })
  }

  #patchSpeed(engine: GraphDataEngine): void {
    if (this.#speedPatches.some((patch) => patch.engine === engine)) {
      return
    }
    const descriptor = Object.getOwnPropertyDescriptor(engine, "progressionSpeed")
    if (descriptor && !descriptor.configurable) {
      return
    }

    let rawSpeed = engine.progressionSpeed
    Object.defineProperty(engine, "progressionSpeed", {
      configurable: true,
      get: () => rawSpeed * this.#speedMultiplier,
      set: (value: number) => {
        rawSpeed = value
      },
    })

    this.#speedPatches.push({
      engine,
      restore: () => {
        Reflect.deleteProperty(engine, "progressionSpeed")
        engine.progressionSpeed = rawSpeed
      },
    })
  }
}

export function getGraphLeaves(app: App): readonly WorkspaceLeaf[] {
  return [...app.workspace.getLeavesOfType("graph"), ...app.workspace.getLeavesOfType("localgraph")]
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function progressionPercent(progression: number, maxProgression: number): number {
  if (maxProgression <= 1) {
    return 100
  }
  const ratio = (clampNumber(progression, 1, maxProgression) - 1) / (maxProgression - 1)
  return Math.round(ratio * 100)
}

export function isGraphRenderer(value: unknown): value is GraphRenderer {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const nodes = (value as Record<string, unknown>)["nodes"]
  return Array.isArray(nodes)
}
