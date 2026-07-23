import type { GraphAnimationControllerSettings } from "./types"
import type { DateSnapshot } from "./types"

export type BigProgressBar = {
  readonly barEl: HTMLElement
  readonly progressSliderEl: HTMLInputElement
  readonly percentValueEl: HTMLSpanElement
  readonly percentInputEl: HTMLInputElement
  render(settings: GraphAnimationControllerSettings, snapshot: DateSnapshot | null, isPlaying: boolean): void
}

export function createBigProgressBar(rootEl: HTMLElement): BigProgressBar {
  const barEl = rootEl.createDiv({ cls: "graph-animation-controller-big-bar" })

  // Single row: [slider……………………] [percent]
  const rowEl = barEl.createDiv({ cls: "graph-animation-controller-big-bar-row" })

  // Center: plain range input in flow (same pattern as speed slider — no absolute positioning)
  const progressSliderEl = rowEl.createEl("input", {
    cls: "graph-animation-controller-big-bar-slider",
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
    progressSliderEl,
    percentValueEl,
    percentInputEl,
    render: (_settings, snapshot, _isPlaying) => {
      const percent = snapshot?.progressPercent ?? 0
      if (progressSliderEl.value !== String(percent)) {
        progressSliderEl.value = String(percent)
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
