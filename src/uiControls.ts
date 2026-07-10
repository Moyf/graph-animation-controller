import { setIcon } from "obsidian"
import type { GraphAnimationControllerSettings } from "./types"

export type GraphControls = {
  readonly controlsEl: HTMLElement
  readonly replayButtonEl: HTMLElement
  readonly backButtonEl: HTMLElement
  readonly playButtonEl: HTMLElement
  readonly forwardButtonEl: HTMLElement
  readonly speedButtonEl: HTMLElement
  readonly speedPopoverEl: HTMLElement
  readonly speedLabelEl: HTMLElement
  readonly speedValueEl: HTMLSpanElement
  readonly speedInputEl: HTMLInputElement
  readonly speedSliderEl: HTMLInputElement
  readonly speedResetButtonEl: HTMLElement
  render(settings: GraphAnimationControllerSettings, isPlaying: boolean): void
}

export function createControls(rootEl: HTMLElement): GraphControls {
  const controlsEl = rootEl.createDiv({ cls: "graph-animation-controller-controls" })
  const replayButtonEl = createIconButton(controlsEl, "lucide-rotate-ccw", "Replay")
  const backButtonEl = createIconButton(controlsEl, "lucide-skip-back", "Seek backward")
  const playButtonEl = createIconButton(controlsEl, "lucide-play", "Play")
  const forwardButtonEl = createIconButton(controlsEl, "lucide-skip-forward", "Seek forward")
  const speedButtonEl = createIconButton(controlsEl, "lucide-gauge", "Playback speed")
  const speedPopoverEl = controlsEl.createDiv({ cls: "graph-animation-controller-popover" })
  const speedHeaderEl = speedPopoverEl.createDiv({ cls: "graph-animation-controller-speed-header" })
  const speedLabelEl = speedHeaderEl.createDiv({ cls: "graph-animation-controller-speed-label" })
  speedLabelEl.createSpan({ text: "Animation speed: " })
  const speedValueEl = speedLabelEl.createEl("span", { cls: "graph-animation-controller-speed-value" })
  const speedInputEl = speedLabelEl.createEl("input", {
    cls: "graph-animation-controller-speed-input",
    attr: { type: "text", inputmode: "decimal", "aria-label": "Animation speed value" },
  })
  const speedBodyEl = speedPopoverEl.createDiv({ cls: "graph-animation-controller-speed-body" })
  const speedSliderEl = speedBodyEl.createEl("input", {
    cls: "graph-animation-controller-speed-slider",
    attr: { type: "range", min: "0.1", max: "10", step: "0.1" },
  })
  const speedResetButtonEl = speedBodyEl.createDiv({
    cls: "clickable-icon graph-animation-controller-reset-button",
    attr: { "aria-label": "Reset speed", role: "button", tabindex: "0" },
  })
  setIcon(speedResetButtonEl, "lucide-rotate-ccw")

  return {
    controlsEl,
    replayButtonEl,
    backButtonEl,
    playButtonEl,
    forwardButtonEl,
    speedButtonEl,
    speedPopoverEl,
    speedLabelEl,
    speedValueEl,
    speedInputEl,
    speedSliderEl,
    speedResetButtonEl,
    render: (settings, isPlaying) => {
      replayButtonEl.toggle(settings.showReplayButton)
      setIcon(playButtonEl, isPlaying ? "lucide-pause" : "lucide-play")
      playButtonEl.setAttribute("aria-label", isPlaying ? "Pause" : "Play")
      const speed = settings.speedMultiplier.toFixed(1)
      if (speedSliderEl.value !== speed) {
        speedSliderEl.value = speed
      }
      if (speedValueEl.textContent !== `${speed}x`) {
        speedValueEl.setText(`${speed}x`)
      }
      if (speedInputEl.value !== speed && activeDocument.activeElement !== speedInputEl) {
        speedInputEl.value = speed
      }
    },
  }
}

function createIconButton(parent: HTMLElement, icon: string, label: string): HTMLElement {
  const buttonEl = parent.createDiv({
    cls: "clickable-icon graph-animation-controller-button",
    attr: { "aria-label": label, role: "button", tabindex: "0" },
  })
  setIcon(buttonEl, icon)
  return buttonEl
}
