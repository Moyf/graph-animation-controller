import { Plugin, debounce } from "obsidian"
import { GraphEngineController, getGraphLeaves } from "./src/graphEngine"
import { GraphUiController } from "./src/graphUi"
import { GraphAnimationSettingTab } from "./src/settings"
import {
  DATE_FORMATS,
  DATE_POSITIONS,
  DEFAULT_SETTINGS,
  readUnknownProperty,
  type DateFormat,
  type DatePosition,
  type GraphAnimationControllerSettings,
} from "./src/types"

export default class GraphAnimationControllerPlugin extends Plugin {
  settings: GraphAnimationControllerSettings = DEFAULT_SETTINGS
  #engineController: GraphEngineController | null = null
  #uiController: GraphUiController | null = null

  async onload(): Promise<void> {
    await this.loadSettings()
    this.#engineController = new GraphEngineController(this.app, this.settings.speedMultiplier)
    this.#uiController = new GraphUiController(this, this.#engineController)
    this.addSettingTab(new GraphAnimationSettingTab(this.app, this))

    const sync = debounce(() => this.syncGraphLeaves(), 200, true)
    this.registerEvent(this.app.workspace.on("layout-change", sync))
    this.registerEvent(this.app.workspace.on("active-leaf-change", sync))
    this.app.workspace.onLayoutReady(() => this.syncGraphLeaves())
  }

  onunload(): void {
    this.#uiController?.unload()
    this.#engineController?.unload()
  }

  getSettings(): GraphAnimationControllerSettings {
    return this.settings
  }

  async saveSettings(settings: GraphAnimationControllerSettings): Promise<void> {
    await this.updateSettings(settings)
  }

  async updateSettings(settings: GraphAnimationControllerSettings): Promise<void> {
    this.settings = normalizeSettings(settings)
    await this.saveData(this.settings)
    this.applySettings()
  }

  applySettings(): void {
    this.#engineController?.setSpeedMultiplier(this.settings.speedMultiplier)
    this.#uiController?.refreshAll()
  }

  syncGraphLeaves(): void {
    this.#uiController?.syncLeaves(getGraphLeaves(this.app))
  }

  async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData())
  }
}

function normalizeSettings(settings: unknown): GraphAnimationControllerSettings {
  return {
    speedMultiplier: readNumber(settings, "speedMultiplier", DEFAULT_SETTINGS.speedMultiplier, 0.1, 10),
    seekStepPercent: readNumber(settings, "seekStepPercent", DEFAULT_SETTINGS.seekStepPercent, 1, 50),
    progressionSliderStepPercent: readNumber(
      settings,
      "progressionSliderStepPercent",
      DEFAULT_SETTINGS.progressionSliderStepPercent,
      1,
      20,
    ),
    showReplayButton: readBoolean(settings, "showReplayButton", DEFAULT_SETTINGS.showReplayButton),
    dateFormat: readDateFormat(settings),
    datePosition: readDatePosition(settings),
    showProgressPercent: readBoolean(settings, "showProgressPercent", DEFAULT_SETTINGS.showProgressPercent),
    showEmojiInCompact: readBoolean(settings, "showEmojiInCompact", DEFAULT_SETTINGS.showEmojiInCompact),
    dateFontFamily: readFontFamily(settings),
    dateScale: readDateScale(settings),
    dateFontWeight: readNumber(settings, "dateFontWeight", DEFAULT_SETTINGS.dateFontWeight, 300, 900),
    dateColor: readString(settings, "dateColor", DEFAULT_SETTINGS.dateColor),
    dateBackground: readString(settings, "dateBackground", DEFAULT_SETTINGS.dateBackground),
    dateOpacity: readNumber(settings, "dateOpacity", DEFAULT_SETTINGS.dateOpacity, 0.05, 1),
    showAdvancedAppearance: readBoolean(
      settings,
      "showAdvancedAppearance",
      DEFAULT_SETTINGS.showAdvancedAppearance,
    ),
  }
}

function readDateFormat(settings: unknown): DateFormat {
  const value = readUnknownProperty(settings, "dateFormat")
  return typeof value === "string" && value in DATE_FORMATS ? (value as DateFormat) : DEFAULT_SETTINGS.dateFormat
}

function readDatePosition(settings: unknown): DatePosition {
  const value = readUnknownProperty(settings, "datePosition")
  return typeof value === "string" && value in DATE_POSITIONS
    ? (value as DatePosition)
    : DEFAULT_SETTINGS.datePosition
}

function readDateScale(settings: unknown): number {
  const scale = readUnknownProperty(settings, "dateScale")
  if (typeof scale === "number") {
    return clampNumber(scale, 0.5, 2.5)
  }
  const legacyFontSize = readUnknownProperty(settings, "dateFontSize")
  if (typeof legacyFontSize === "number") {
    return clampNumber(legacyFontSize / 13, 0.5, 2.5)
  }
  return DEFAULT_SETTINGS.dateScale
}

function readFontFamily(settings: unknown): string {
  const value = readUnknownProperty(settings, "dateFontFamily")
  if (typeof value !== "string") {
    return DEFAULT_SETTINGS.dateFontFamily
  }
  const trimmed = value.trim()
  return trimmed === "" || trimmed === "var(--font-interface)" ? DEFAULT_SETTINGS.dateFontFamily : trimmed
}

function readBoolean(settings: unknown, key: keyof GraphAnimationControllerSettings, fallback: boolean): boolean {
  const value = readUnknownProperty(settings, key)
  return typeof value === "boolean" ? value : fallback
}

function readNumber(
  settings: unknown,
  key: keyof GraphAnimationControllerSettings,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = readUnknownProperty(settings, key)
  return typeof value === "number" ? clampNumber(value, min, max) : fallback
}

function readString(settings: unknown, key: keyof GraphAnimationControllerSettings, fallback: string): string {
  const value = readUnknownProperty(settings, key)
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}
