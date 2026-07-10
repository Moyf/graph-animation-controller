import type { WorkspaceLeaf } from "obsidian"
import { createControls, type GraphControls } from "./uiControls"
import { createOverlay, updateOverlay } from "./uiOverlay"
import type { GraphEngineController } from "./graphEngine"
import type { DatePosition, GraphAnimationControllerApi, GraphDataEngine } from "./types"
import { readGraphEngine, readUnknownProperty } from "./types"

type GraphUiRecord = {
  readonly leaf: WorkspaceLeaf
  readonly engine: GraphDataEngine
  readonly rootEl: HTMLElement
  readonly controls: GraphControls
  readonly overlay: ReturnType<typeof createOverlay>
  readonly intervalId: number
  lastState: string
}

const UPDATE_INTERVAL_MS = 250

export class GraphUiController {
  readonly #api: GraphAnimationControllerApi
  readonly #engineController: GraphEngineController
  readonly #records = new Map<WorkspaceLeaf, GraphUiRecord>()

  constructor(api: GraphAnimationControllerApi, engineController: GraphEngineController) {
    this.#api = api
    this.#engineController = engineController
  }

  syncLeaf(leaf: WorkspaceLeaf): void {
    if (this.#records.has(leaf)) {
      this.refreshLeaf(leaf)
      return
    }

    const engine = readGraphEngine(leaf)
    const rootEl = readViewContentElement(leaf)
    if (!engine || !rootEl) {
      return
    }

    this.#engineController.patchEngine(engine)
    const overlay = createOverlay(rootEl)
    const controls = createControls(rootEl)
    const record: GraphUiRecord = {
      leaf,
      engine,
      rootEl,
      controls,
      overlay,
      intervalId: window.setInterval(() => this.refreshLeaf(leaf), UPDATE_INTERVAL_MS),
      lastState: "",
    }

    controls.replayButtonEl.onClickEvent(() => {
      this.#engineController.replay(engine)
      this.refreshLeaf(leaf)
      releaseFocus(controls.replayButtonEl)
    })
    controls.backButtonEl.onClickEvent(() => {
      this.#engineController.seek(engine, -1, this.#api.getSettings().seekStepPercent)
      this.refreshLeaf(leaf)
      releaseFocus(controls.backButtonEl)
    })
    controls.playButtonEl.onClickEvent(() => {
      if (engine._graphAnimationControllerPaused !== true && engine.progression > 0) {
        this.#engineController.pause(engine)
      } else {
        this.#engineController.play(engine)
      }
      this.refreshLeaf(leaf)
      releaseFocus(controls.playButtonEl)
    })
    controls.forwardButtonEl.onClickEvent(() => {
      this.#engineController.seek(engine, 1, this.#api.getSettings().seekStepPercent)
      this.refreshLeaf(leaf)
      releaseFocus(controls.forwardButtonEl)
    })
    controls.speedButtonEl.onClickEvent(() => {
      controls.speedPopoverEl.toggleClass("is-open", !controls.speedPopoverEl.hasClass("is-open"))
      releaseFocus(controls.speedButtonEl)
    })
    controls.speedValueEl.onClickEvent(() => {
      controls.speedLabelEl.addClass("is-editing")
      controls.speedInputEl.focus()
      controls.speedInputEl.select()
    })
    controls.speedInputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.#commitSpeedInput(controls)
      }
      if (event.key === "Escape") {
        controls.speedLabelEl.removeClass("is-editing")
        this.refreshLeaf(leaf)
      }
    })
    controls.speedInputEl.addEventListener("blur", () => this.#commitSpeedInput(controls))
    controls.speedSliderEl.addEventListener("input", () => {
      const next = Number.parseFloat(controls.speedSliderEl.value)
      void this.#api.saveSettings({ ...this.#api.getSettings(), speedMultiplier: next })
      this.#api.applySettings()
      this.refreshLeaf(leaf)
    })
    controls.speedResetButtonEl.onClickEvent(() => {
      void this.#api.saveSettings({ ...this.#api.getSettings(), speedMultiplier: 1 })
      this.#api.applySettings()
      this.refreshLeaf(leaf)
      releaseFocus(controls.speedResetButtonEl)
    })
    overlay.overlayEl.onClickEvent(() => {
      overlay.positionPopoverEl.toggleClass("is-open", !overlay.positionPopoverEl.hasClass("is-open"))
      releaseFocus(overlay.overlayEl)
    })
    rootEl.addEventListener("pointerdown", (event) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (overlay.overlayEl.contains(target) || overlay.positionPopoverEl.contains(target)) {
        return
      }
      overlay.positionPopoverEl.removeClass("is-open")
    })
    overlay.progressionSliderEl.addEventListener("input", () => {
      const percent = Number.parseInt(overlay.progressionSliderEl.value, 10)
      this.#engineController.setProgressPercent(engine, percent)
      this.refreshLeaf(leaf)
    })
    overlay.progressionValueEl.onClickEvent(() => {
      overlay.positionPopoverEl.addClass("is-editing-progression")
      overlay.progressionInputEl.focus()
      overlay.progressionInputEl.select()
    })
    overlay.progressionInputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.#commitProgressionInput(overlay, engine, leaf)
      }
      if (event.key === "Escape") {
        overlay.positionPopoverEl.removeClass("is-editing-progression")
        this.refreshLeaf(leaf)
      }
    })
    overlay.progressionInputEl.addEventListener("blur", () => this.#commitProgressionInput(overlay, engine, leaf))
    for (const button of overlay.positionButtonEls) {
      button.onClickEvent(() => {
        const position = button.dataset.position
        if (!isDatePosition(position)) {
          return
        }
        void this.#api.saveSettings({ ...this.#api.getSettings(), datePosition: position })
        this.#api.applySettings()
        releaseFocus(button)
      })
    }

    this.#records.set(leaf, record)
    this.refreshLeaf(leaf)
  }

  syncLeaves(leaves: readonly WorkspaceLeaf[]): void {
    for (const leaf of leaves) {
      this.syncLeaf(leaf)
    }
    for (const leaf of this.#records.keys()) {
      if (!leaves.includes(leaf)) {
        this.removeLeaf(leaf)
      }
    }
  }

  refreshAll(): void {
    for (const leaf of this.#records.keys()) {
      this.refreshLeaf(leaf)
    }
  }

  refreshLeaf(leaf: WorkspaceLeaf): void {
    const record = this.#records.get(leaf)
    if (!record) {
      return
    }
    const settings = this.#api.getSettings()
    const snapshot = this.#engineController.getDateSnapshot(record.engine)
    const isPlaying = record.engine._graphAnimationControllerPaused !== true && record.engine.progression > 0
    const state = JSON.stringify({
      settings,
      timestamp: snapshot?.timestamp ?? null,
      progressPercent: snapshot?.progressPercent ?? null,
      isPlaying,
    })
    if (record.lastState === state) {
      return
    }
    record.lastState = state
    record.controls.render(settings, isPlaying)
    updateOverlay(record.overlay, record.rootEl, snapshot, settings)
  }

  removeLeaf(leaf: WorkspaceLeaf): void {
    const record = this.#records.get(leaf)
    if (!record) {
      return
    }
    window.clearInterval(record.intervalId)
    record.overlay.overlayEl.remove()
    record.overlay.positionPopoverEl.remove()
    record.controls.controlsEl.remove()
    this.#records.delete(leaf)
  }

  unload(): void {
    for (const leaf of Array.from(this.#records.keys())) {
      this.removeLeaf(leaf)
    }
  }

  #commitSpeedInput(controls: GraphControls): void {
    const parsed = Number.parseFloat(controls.speedInputEl.value)
    if (!Number.isFinite(parsed)) {
      controls.speedInputEl.addClass("is-invalid")
      return
    }
    const next = Math.min(Math.max(parsed, 0.1), 10)
    controls.speedInputEl.removeClass("is-invalid")
    controls.speedLabelEl.removeClass("is-editing")
    void this.#api.saveSettings({ ...this.#api.getSettings(), speedMultiplier: next })
    this.#api.applySettings()
  }

  #commitProgressionInput(
    overlay: ReturnType<typeof createOverlay>,
    engine: GraphDataEngine,
    leaf: WorkspaceLeaf,
  ): void {
    const parsed = Number.parseInt(overlay.progressionInputEl.value, 10)
    if (!Number.isFinite(parsed)) {
      overlay.progressionInputEl.addClass("is-invalid")
      return
    }
    const next = Math.min(Math.max(parsed, 0), 100)
    overlay.progressionInputEl.removeClass("is-invalid")
    overlay.positionPopoverEl.removeClass("is-editing-progression")
    this.#engineController.setProgressPercent(engine, next)
    this.refreshLeaf(leaf)
  }
}

function readViewContentElement(leaf: WorkspaceLeaf): HTMLElement | null {
  const containerEl = readUnknownProperty(leaf, "containerEl")
  if (!(containerEl instanceof HTMLElement)) {
    return null
  }
  const viewContentEl = containerEl.querySelector(".view-content")
  return viewContentEl instanceof HTMLElement ? viewContentEl : null
}

function isDatePosition(value: string | undefined): value is DatePosition {
  return (
    value === "bottomLeft" ||
    value === "topLeft" ||
    value === "topRight" ||
    value === "bottomRight" ||
    value === "hero"
  )
}

function releaseFocus(element: HTMLElement): void {
  window.setTimeout(() => element.blur(), 0)
}
