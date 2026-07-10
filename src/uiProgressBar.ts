import type { GraphAnimationControllerSettings } from "./types"
import type { DateSnapshot } from "./types"

export type BigProgressBar = {
  readonly barEl: HTMLElement
  readonly progressTrackEl: HTMLElement
  readonly progressFillEl: HTMLElement
  readonly progressInputEl: HTMLInputElement
  readonly percentValueEl: HTMLSpanElement
  readonly percentInputEl: HTMLInputElement
  render(settings: GraphAnimationControllerSettings, snapshot: DateSnapshot | null, isPlaying: boolean): void
}

export function createBigProgressBar(rootEl: HTMLElement): BigProgressBar {
  const barEl = rootEl.createDiv({ cls: "graph-animation-controller-big-bar" })

  // Single row: [track……………………] [percent]
  const rowEl = barEl.createDiv({ cls: "graph-animation-controller-big-bar-row" })

  // Center: progress track
  const progressTrackEl = rowEl.createDiv({ cls: "graph-animation-controller-big-bar-track" })
  const progressFillEl = progressTrackEl.createDiv({ cls: "graph-animation-controller-big-bar-fill" })
  // Range input sits on top of the visual track — handles both click and drag natively
  const progressInputEl = progressTrackEl.createEl("input", {
    cls: "graph-animation-controller-big-bar-input",
    attr: { type: "range", min: "0", max: "100", step: "1", "aria-label": "Timeline position" },
  })

  // Right: editable percent — span and input coexist, toggled via CSS class (no layout shift)
  const percentWrapEl = rowEl.createDiv({ cls: "graph-animation-controller-big-bar-percent-wrap" })
  const percentValueEl = percentWrapEl.createEl("span", {
    cls: "graph-animation-controller-big-bar-percent-value",
    attr: { "aria-label": "Click to edit progression percent" },
  })
  const percentInputEl = percentWrapEl.createEl("input", {
    cls: "graph-animation-controller-big-bar-percent-input",
    attr: { type: "text", inputmode: "numeric", "aria-label": "Progression percent" },
  })

  barEl.hide()

  return {
    barEl,
    progressTrackEl,
    progressFillEl,
    progressInputEl,
    percentValueEl,
    percentInputEl,
    render: (_settings, snapshot, _isPlaying) => {
      const percent = snapshot?.progressPercent ?? 0
      progressFillEl.style.width = `${percent}%`
      if (progressInputEl.value !== String(percent)) {
        progressInputEl.value = String(percent)
      }

      const percentText = `${percent}%`
      if (percentValueEl.textContent !== percentText) {
        percentValueEl.setText(percentText)
      }
      if (activeDocument.activeElement !== percentInputEl) {
        percentInputEl.value = String(percent)
      }
    },
  }
}
