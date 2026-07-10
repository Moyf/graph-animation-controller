import type { App, TFile, WorkspaceLeaf } from "obsidian"

export const DATE_FORMATS = {
  iso: "YYYY-MM-DD",
  locale: "Local date",
  localeDateTime: "Local date and time",
  yearMonth: "YYYY-MM",
  year: "YYYY",
} as const

export type DateFormat = keyof typeof DATE_FORMATS

export const DATE_POSITIONS = {
  bottomLeft: "Bottom left",
  topLeft: "Top left",
  topRight: "Top right",
  bottomRight: "Bottom right",
  hero: "Hero center",
} as const

export type DatePosition = keyof typeof DATE_POSITIONS

export type GraphAnimationControllerSettings = {
  readonly speedMultiplier: number
  readonly seekStepPercent: number
  readonly progressionSliderStepPercent: number
  readonly showReplayButton: boolean
  readonly dateFormat: DateFormat
  readonly datePosition: DatePosition
  readonly showProgressPercent: boolean
  readonly showEmojiInCompact: boolean
  readonly dateFontFamily: string
  readonly dateScale: number
  readonly dateFontWeight: number
  readonly dateColor: string
  readonly dateBackground: string
  readonly dateOpacity: number
  readonly showAdvancedAppearance: boolean
}

export const DEFAULT_SETTINGS: GraphAnimationControllerSettings = {
  speedMultiplier: 1,
  seekStepPercent: 10,
  progressionSliderStepPercent: 5,
  showReplayButton: true,
  dateFormat: "iso",
  datePosition: "bottomLeft",
  showProgressPercent: true,
  showEmojiInCompact: true,
  dateFontFamily: "var(--font-monospace)",
  dateScale: 1,
  dateFontWeight: 600,
  dateColor: "var(--text-muted)",
  dateBackground: "var(--background-primary)",
  dateOpacity: 1,
  showAdvancedAppearance: false,
}

export type GraphNode = {
  readonly id: string
}

export type GraphRenderer = {
  readonly nodes: readonly GraphNode[]
}

export type GraphDataEngine = {
  progression: number
  progressionSpeed: number
  readonly renderer: GraphRenderer
  render(): number
  renderProgression(): Promise<void>
  _graphAnimationControllerResumeFrom?: number | undefined
  _graphAnimationControllerPaused?: boolean | undefined
  _graphAnimationControllerMaxProgression?: number | undefined
}

export type GraphView = {
  readonly dataEngine?: GraphDataEngine
}

export type GraphLeaf = WorkspaceLeaf & {
  readonly view: WorkspaceLeaf["view"] & GraphView
}

export type DateSnapshot = {
  readonly file: TFile
  readonly timestamp: number
  readonly progressPercent: number
}

export type GraphAnimationControllerApi = {
  readonly app: App
  getSettings(): GraphAnimationControllerSettings
  saveSettings(settings: GraphAnimationControllerSettings): Promise<void>
  applySettings(): void
}

export type EnginePatchRecord = {
  readonly prototype: object
  readonly originalRenderProgression: GraphDataEngine["renderProgression"]
}

export type SpeedPatchRecord = {
  readonly engine: GraphDataEngine
  readonly restore: () => void
}

export function isGraphLeaf(leaf: WorkspaceLeaf): leaf is GraphLeaf {
  return isGraphDataEngine(readUnknownProperty(readUnknownProperty(leaf, "view"), "dataEngine"))
}

export function readGraphEngine(leaf: WorkspaceLeaf): GraphDataEngine | null {
  const engine = readUnknownProperty(readUnknownProperty(leaf, "view"), "dataEngine")
  return isGraphDataEngine(engine) ? engine : null
}

export function readUnknownProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined
  }
  return key in value ? value[key as keyof typeof value] : undefined
}

function isGraphDataEngine(value: unknown): value is GraphDataEngine {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  const renderer = record["renderer"]
  return (
    typeof record["render"] === "function" &&
    typeof record["renderProgression"] === "function" &&
    typeof record["progression"] === "number" &&
    typeof record["progressionSpeed"] === "number" &&
    typeof renderer === "object" &&
    renderer !== null &&
    Array.isArray((renderer as Record<string, unknown>)["nodes"])
  )
}

export function isTFileLike(file: unknown): file is TFile {
  if (typeof file !== "object" || file === null) {
    return false
  }
  const stat = readUnknownProperty(file, "stat")
  return typeof readUnknownProperty(file, "path") === "string" && typeof stat === "object" && stat !== null
}
