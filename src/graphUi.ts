import type { WorkspaceLeaf } from "obsidian"
import { bindGraphActionButtons, createGraphActionExecutor, type GraphActionExecutor } from "./graphActions"
import { createControls, type GraphControls } from "./uiControls"
import { createOverlay, updateOverlay } from "./uiOverlay"
import { createBigProgressBar, type BigProgressBar } from "./uiProgressBar"
import type { GraphEngineController } from "./graphEngine"
import type { GraphKeyboardAction } from "./keyboardShortcuts"
import type { DatePosition, GraphAnimationControllerApi, GraphDataEngine } from "./types"
import { readGraphEngine, readUnknownProperty } from "./types"

type GraphUiRecord = {
  readonly leaf: WorkspaceLeaf
  readonly engine: GraphDataEngine
  readonly rootEl: HTMLElement
  readonly controls: GraphControls
  readonly overlay: ReturnType<typeof createOverlay>
  readonly bigProgressBar: BigProgressBar
  readonly cleanup: () => void
  readonly intervalId: number
  lastState: string
  bigProgressBarOpen: boolean
}

const UPDATE_INTERVAL_MS = 250

export class GraphUiController {
  readonly #api: GraphAnimationControllerApi
  readonly #engineController: GraphEngineController
  readonly #actions: GraphActionExecutor
  readonly #records = new Map<WorkspaceLeaf, GraphUiRecord>()

  constructor(api: GraphAnimationControllerApi, engineController: GraphEngineController) {
    this.#api = api
    this.#engineController = engineController
    this.#actions = createGraphActionExecutor(api, engineController)
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
    const bigProgressBar = createBigProgressBar(rootEl)
    let cleanup = (): void => undefined

    const record: GraphUiRecord = {
      leaf,
      engine,
      rootEl,
      controls,
      overlay,
      bigProgressBar,
      cleanup: () => cleanup(),
      intervalId: window.setInterval(() => this.refreshLeaf(leaf), UPDATE_INTERVAL_MS),
      lastState: "",
      bigProgressBarOpen: false,
    }

    // --- Overlay wiring ---
    overlay.dateEl.onClickEvent(() => {
      overlay.positionPopoverEl.toggleClass("is-open", !overlay.positionPopoverEl.hasClass("is-open"))
      releaseFocus(overlay.dateEl)
    })
    overlay.percentEl.onClickEvent(() => {
      this.#toggleBigProgressBar(record)
      releaseFocus(overlay.percentEl)
    })
    const handleRootPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (overlay.overlayEl.contains(target) || overlay.positionPopoverEl.contains(target)) return
      overlay.positionPopoverEl.removeClass("is-open")
    }
    rootEl.addEventListener("pointerdown", handleRootPointerDown)
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
      if (event.key === "Enter") this.#commitProgressionInput(overlay, engine, leaf)
      if (event.key === "Escape") {
        overlay.positionPopoverEl.removeClass("is-editing-progression")
        this.refreshLeaf(leaf)
      }
    })
    overlay.progressionInputEl.addEventListener("blur", () => this.#commitProgressionInput(overlay, engine, leaf))
    for (const button of overlay.positionButtonEls) {
      button.onClickEvent(() => {
        const position = button.dataset.position
        if (!isDatePosition(position)) return
        void this.#api.saveSettings({ ...this.#api.getSettings(), datePosition: position })
        this.#api.applySettings()
        releaseFocus(button)
      })
    }

    // --- Small controls wiring ---
    bindGraphActionButtons({ controls, run: (action) => this.#runGraphAction(record, action) })
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
      if (event.key === "Enter") this.#commitSpeedInput(controls)
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
    // --- Big progress bar wiring ---

    let resumeAfterScrub = false
    bigProgressBar.progressSliderEl.addEventListener("pointerdown", () => {
      resumeAfterScrub = engine._graphAnimationControllerPaused !== true && engine.progression > 0
      if (resumeAfterScrub) {
        this.#engineController.pause(engine)
      }
    })
    bigProgressBar.progressSliderEl.addEventListener("input", () => {
      const percent = Number.parseInt(bigProgressBar.progressSliderEl.value, 10)
      this.#engineController.previewProgressPercent(engine, percent)
      this.refreshLeaf(leaf)
    })
    bigProgressBar.progressSliderEl.addEventListener("change", () => {
      const percent = Number.parseInt(bigProgressBar.progressSliderEl.value, 10)
      this.#engineController.setProgressPercent(engine, percent)
      if (resumeAfterScrub) {
        this.#engineController.play(engine)
      }
      resumeAfterScrub = false
      this.refreshLeaf(leaf)
    })

    // Percent label → editable input (no layout shift: both elements stay in flow,
    // switching is done via CSS visibility so the wrapper keeps its size)
    bigProgressBar.percentValueEl.onClickEvent(() => {
      bigProgressBar.barEl.addClass("is-editing-percent")
      bigProgressBar.percentInputEl.focus()
      bigProgressBar.percentInputEl.select()
    })
    bigProgressBar.percentInputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.#commitBigBarPercentInput(bigProgressBar, engine, leaf)
      if (event.key === "Escape") {
        bigProgressBar.barEl.removeClass("is-editing-percent")
        this.refreshLeaf(leaf)
      }
    })
    bigProgressBar.percentInputEl.addEventListener("blur", () =>
      this.#commitBigBarPercentInput(bigProgressBar, engine, leaf),
    )

    cleanup = () => rootEl.removeEventListener("pointerdown", handleRootPointerDown)
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

  handleKeyboardAction(leaf: WorkspaceLeaf, action: GraphKeyboardAction): boolean {
    if (leaf.getViewState().type !== "graph") {
      return false
    }
    this.syncLeaf(leaf)
    const record = this.#records.get(leaf)
    if (!record) return false
    this.#runGraphAction(record, action)
    return true
  }

  refreshLeaf(leaf: WorkspaceLeaf): void {
    const record = this.#records.get(leaf)
    if (!record) return
    const settings = this.#api.getSettings()
    const snapshot = this.#engineController.getDateSnapshot(record.engine)
    const isPlaying = record.engine._graphAnimationControllerPaused !== true && record.engine.progression > 0
    const state = JSON.stringify({
      settings,
      timestamp: snapshot?.timestamp ?? null,
      progressPercent: snapshot?.progressPercent ?? null,
      isPlaying,
      bigProgressBarOpen: record.bigProgressBarOpen,
    })
    if (record.lastState === state) return
    record.lastState = state
    record.controls.render(settings, isPlaying)
    record.bigProgressBar.render(settings, snapshot, isPlaying)
    updateOverlay(record.overlay, record.rootEl, snapshot, settings, record.bigProgressBarOpen)
  }

  removeLeaf(leaf: WorkspaceLeaf): void {
    const record = this.#records.get(leaf)
    if (!record) return
    window.clearInterval(record.intervalId)
    record.cleanup()
    record.overlay.overlayEl.remove()
    record.overlay.positionPopoverEl.remove()
    record.controls.controlsEl.remove()
    record.bigProgressBar.barEl.remove()
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

  #runGraphAction(record: GraphUiRecord, action: GraphKeyboardAction): void {
    this.#actions.run(
      {
        engine: record.engine,
        refresh: () => this.refreshLeaf(record.leaf),
        toggleBigProgressBar: () => this.#toggleBigProgressBar(record),
      },
      action,
    )
  }

  #toggleBigProgressBar(record: GraphUiRecord): void {
    record.bigProgressBarOpen = !record.bigProgressBarOpen
    record.bigProgressBar.barEl.toggle(record.bigProgressBarOpen)
    record.lastState = ""
    this.refreshLeaf(record.leaf)
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

  #commitBigBarPercentInput(bigProgressBar: BigProgressBar, engine: GraphDataEngine, leaf: WorkspaceLeaf): void {
    const parsed = Number.parseInt(bigProgressBar.percentInputEl.value, 10)
    if (!Number.isFinite(parsed)) {
      bigProgressBar.percentInputEl.addClass("is-invalid")
      return
    }
    const next = Math.min(Math.max(parsed, 0), 100)
    bigProgressBar.percentInputEl.removeClass("is-invalid")
    bigProgressBar.barEl.removeClass("is-editing-percent")
    this.#engineController.setProgressPercent(engine, next)
    this.refreshLeaf(leaf)
  }
}

function readViewContentElement(leaf: WorkspaceLeaf): HTMLElement | null {
  const containerEl = readUnknownProperty(leaf, "containerEl")
  if (!(containerEl instanceof HTMLElement)) return null
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
