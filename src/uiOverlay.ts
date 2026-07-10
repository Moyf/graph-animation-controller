import { formatDate } from "./dateFormat"
import type { DateSnapshot, GraphAnimationControllerSettings } from "./types"
import { DATE_POSITIONS, type DatePosition } from "./types"

export type GraphOverlay = {
  readonly overlayEl: HTMLElement
  readonly dateEl: HTMLElement
  readonly percentEl: HTMLElement
  readonly positionPopoverEl: HTMLElement
  readonly progressionSliderEl: HTMLInputElement
  readonly progressionValueEl: HTMLSpanElement
  readonly progressionInputEl: HTMLInputElement
  readonly positionButtonEls: readonly HTMLElement[]
}

export function createOverlay(rootEl: HTMLElement): GraphOverlay {
  const overlayEl = rootEl.createDiv({ cls: "graph-animation-controller-overlay" })
  const dateEl = overlayEl.createDiv({ cls: "graph-animation-controller-overlay-date" })
  const percentEl = overlayEl.createDiv({ cls: "graph-animation-controller-overlay-percent" })
  const positionPopoverEl = rootEl.createDiv({ cls: "graph-animation-controller-position-popover" })
  const sliderWrapEl = positionPopoverEl.createDiv({ cls: "graph-animation-controller-progression-wrap" })
  const progressionSliderEl = sliderWrapEl.createEl("input", {
    cls: "graph-animation-controller-progression-slider",
    attr: { type: "range", min: "0", max: "100", step: "5" },
  })
  const progressionValueWrapEl = sliderWrapEl.createDiv({ cls: "graph-animation-controller-progression-value-wrap" })
  const progressionValueEl = progressionValueWrapEl.createEl("span", {
    cls: "graph-animation-controller-progression-value",
  })
  const progressionInputEl = progressionValueWrapEl.createEl("input", {
    cls: "graph-animation-controller-progression-input",
    attr: { type: "text", inputmode: "numeric", "aria-label": "Progression percent" },
  })
  const gridEl = positionPopoverEl.createDiv({ cls: "graph-animation-controller-position-grid" })
  const orderedPositions: readonly DatePosition[] = ["hero", "topLeft", "topRight", "bottomLeft", "bottomRight"]
  const positionButtonEls = orderedPositions.map((position) =>
    gridEl.createEl("button", {
      text: DATE_POSITIONS[position],
      cls: "graph-animation-controller-position-button",
      attr: { type: "button", "data-position": position },
    }),
  )
  const canvas = rootEl.querySelector("canvas")
  if (canvas) {
    rootEl.insertBefore(overlayEl, canvas)
  }
  return {
    overlayEl,
    dateEl,
    percentEl,
    positionPopoverEl,
    progressionSliderEl,
    progressionValueEl,
    progressionInputEl,
    positionButtonEls,
  }
}

export function updateOverlay(
  overlay: GraphOverlay,
  rootEl: HTMLElement,
  snapshot: DateSnapshot | null,
  settings: GraphAnimationControllerSettings,
  bigProgressBarOpen: boolean,
): void {
  applyRootStyle(rootEl, settings)
  applyOverlayStyle(overlay.overlayEl, overlay.positionPopoverEl, settings.datePosition)
  for (const button of overlay.positionButtonEls) {
    button.toggleClass("is-active", button.dataset.position === settings.datePosition)
  }
  overlay.progressionSliderEl.step = String(settings.progressionSliderStepPercent)
  if (!snapshot) {
    overlay.overlayEl.removeClass("is-visible")
    return
  }
  const prefix = settings.showEmojiInCompact && settings.datePosition !== "hero" ? "📅 " : ""
  overlay.dateEl.setText(`${prefix}${formatDate(snapshot.timestamp, settings.dateFormat)}`)
  overlay.percentEl.setText(`${snapshot.progressPercent}%`)
  overlay.percentEl.toggle(settings.showProgressPercent)
  overlay.percentEl.toggleClass("is-active", bigProgressBarOpen)
  overlay.progressionSliderEl.value = String(snapshot.progressPercent)
  if (overlay.progressionValueEl.textContent !== `${snapshot.progressPercent}%`) {
    overlay.progressionValueEl.setText(`${snapshot.progressPercent}%`)
  }
  if (activeDocument.activeElement !== overlay.progressionInputEl) {
    overlay.progressionInputEl.value = String(snapshot.progressPercent)
  }
  overlay.overlayEl.addClass("is-visible")
}

function applyRootStyle(rootEl: HTMLElement, settings: GraphAnimationControllerSettings): void {
  rootEl.style.setProperty("--graph-animation-controller-date-font-family", settings.dateFontFamily)
  rootEl.style.setProperty("--graph-animation-controller-date-scale", String(settings.dateScale))
  rootEl.style.setProperty("--graph-animation-controller-date-font-weight", String(settings.dateFontWeight))
  rootEl.style.setProperty("--graph-animation-controller-date-color", settings.dateColor)
  rootEl.style.setProperty("--graph-animation-controller-date-background", settings.dateBackground)
  rootEl.style.setProperty("--graph-animation-controller-date-opacity", String(settings.dateOpacity))
}

function applyOverlayStyle(
  overlayEl: HTMLElement,
  positionPopoverEl: HTMLElement,
  position: DatePosition,
): void {
  overlayEl.removeClass("is-compact", "is-hero")
  overlayEl.addClass(position === "hero" ? "is-hero" : "is-compact")
  clearPosition(overlayEl)
  clearPosition(positionPopoverEl)
  switch (position) {
    case "bottomLeft":
      setPosition(overlayEl, { bottom: "52px", left: "12px" })
      setPosition(positionPopoverEl, { bottom: "92px", left: "12px" })
      return
    case "topLeft":
      setPosition(overlayEl, { top: "12px", left: "12px" })
      setPosition(positionPopoverEl, { top: "48px", left: "12px" })
      return
    case "topRight":
      setPosition(overlayEl, { top: "12px", right: "100px" })
      setPosition(positionPopoverEl, { top: "48px", right: "100px" })
      return
    case "bottomRight":
      setPosition(overlayEl, { right: "12px", bottom: "52px" })
      setPosition(positionPopoverEl, { right: "12px", bottom: "92px" })
      return
    case "hero":
      setPosition(overlayEl, { top: "18%", left: "50%", transform: "translateX(-50%)" })
      setPosition(positionPopoverEl, { top: "calc(18% + 72px)", left: "50%", transform: "translateX(-50%)" })
      return
  }
}

function clearPosition(element: HTMLElement): void {
  element.style.removeProperty("top")
  element.style.removeProperty("right")
  element.style.removeProperty("bottom")
  element.style.removeProperty("left")
  element.style.removeProperty("transform")
}

function setPosition(element: HTMLElement, position: Record<string, string>): void {
  for (const [key, value] of Object.entries(position)) {
    element.style.setProperty(key, value)
  }
}
