import { setIcon } from "obsidian"
import type { GraphAnimationControllerSettings } from "./types"
import { formatDate } from "./dateFormat"
import type { DateSnapshot } from "./types"

export type BigProgressBar = {
  readonly barEl: HTMLElement
  readonly progressTrackEl: HTMLElement
  readonly progressFillEl: HTMLElement
  readonly progressInputEl: HTMLInputElement
  readonly timeDisplayEl: HTMLElement
  readonly percentValueEl: HTMLSpanElement
  readonly percentInputEl: HTMLInputElement
  readonly playButtonEl: HTMLElement
  readonly backButtonEl: HTMLElement
  readonly forwardButtonEl: HTMLElement
  readonly replayButtonEl: HTMLElement
  render(settings: GraphAnimationControllerSettings, snapshot: DateSnapshot | null, isPlaying: boolean): void
}

export function createBigProgressBar(rootEl: HTMLElement): BigProgressBar {
  const barEl = rootEl.createDiv({ cls: "graph-animation-controller-big-bar" })

  // Track row: full-width scrubber
  const trackRowEl = barEl.createDiv({ cls: "graph-animation-controller-big-bar-track-row" })
  const progressTrackEl = trackRowEl.createDiv({ cls: "graph-animation-controller-big-bar-track" })
  const progressFillEl = progressTrackEl.createDiv({ cls: "graph-animation-controller-big-bar-fill" })
  // Range input sits on top of the visual track for interaction
  const progressInputEl = progressTrackEl.createEl("input", {
    cls: "graph-animation-controller-big-bar-input",
    attr: { type: "range", min: "0", max: "100", step: "1", "aria-label": "Timeline position" },
  })

  // Controls row: left group (buttons + date) and right group (editable percent)
  const controlsRowEl = barEl.createDiv({ cls: "graph-animation-controller-big-bar-controls" })

  const leftGroupEl = controlsRowEl.createDiv({ cls: "graph-animation-controller-big-bar-left" })
  const replayButtonEl = createBarIconButton(leftGroupEl, "lucide-rotate-ccw", "Replay")
  const backButtonEl = createBarIconButton(leftGroupEl, "lucide-skip-back", "Seek backward")
  const playButtonEl = createBarIconButton(leftGroupEl, "lucide-play", "Play")
  const forwardButtonEl = createBarIconButton(leftGroupEl, "lucide-skip-forward", "Seek forward")
  const timeDisplayEl = leftGroupEl.createDiv({ cls: "graph-animation-controller-big-bar-time" })

  // Right: editable percent (click label to edit)
  const rightGroupEl = controlsRowEl.createDiv({ cls: "graph-animation-controller-big-bar-right" })
  const percentWrapEl = rightGroupEl.createDiv({ cls: "graph-animation-controller-big-bar-percent-wrap" })
  const percentValueEl = percentWrapEl.createEl("span", { cls: "graph-animation-controller-big-bar-percent-value" })
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
    timeDisplayEl,
    percentValueEl,
    percentInputEl,
    playButtonEl,
    backButtonEl,
    forwardButtonEl,
    replayButtonEl,
    render: (settings, snapshot, isPlaying) => {
      const percent = snapshot?.progressPercent ?? 0
      progressFillEl.style.width = `${percent}%`
      if (progressInputEl.value !== String(percent)) {
        progressInputEl.value = String(percent)
      }

      setIcon(playButtonEl, isPlaying ? "lucide-pause" : "lucide-play")
      playButtonEl.setAttribute("aria-label", isPlaying ? "Pause" : "Play")

      if (snapshot) {
        timeDisplayEl.setText(formatDate(snapshot.timestamp, settings.dateFormat))
      } else {
        timeDisplayEl.setText("")
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

function createBarIconButton(parent: HTMLElement, icon: string, label: string): HTMLElement {
  const buttonEl = parent.createDiv({
    cls: "clickable-icon graph-animation-controller-big-bar-button",
    attr: { "aria-label": label, role: "button", tabindex: "0" },
  })
  setIcon(buttonEl, icon)
  return buttonEl
}
