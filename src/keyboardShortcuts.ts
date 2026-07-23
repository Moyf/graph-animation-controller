export type GraphKeyboardAction =
  | "playPause"
  | "replay"
  | "seekBackward"
  | "seekForward"
  | "toggleBigProgressBar"

export type GraphKeyboardResult =
  | { readonly kind: "ignored" }
  | { readonly kind: "consumed" }
  | { readonly kind: "action"; readonly action: GraphKeyboardAction }

export type GraphKeyboardTargetKind = "neutral" | "button" | "input" | "contentEditable"

export type GraphKeyboardInput = {
  readonly key: string
  readonly repeat?: boolean
  readonly defaultPrevented?: boolean
  readonly isComposing?: boolean
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
  readonly altKey?: boolean
  readonly shiftKey?: boolean
  readonly targetKind?: GraphKeyboardTargetKind
}

export type GraphKeyboardContextInput = {
  readonly enabled: boolean
  readonly activeViewType: string | undefined
  readonly input: GraphKeyboardInput
}

export function readGraphKeyboardInputResult(input: GraphKeyboardInput): GraphKeyboardResult {
  if (shouldIgnoreKeyboardInput(input)) {
    return { kind: "ignored" }
  }

  const action = readKeyAction(input.key)
  if (!action) {
    return { kind: "ignored" }
  }

  return input.repeat === true && !allowsRepeat(action) ? { kind: "consumed" } : { kind: "action", action }
}

export function readGraphKeyboardContextInputResult(context: GraphKeyboardContextInput): GraphKeyboardResult {
  if (!context.enabled || context.activeViewType !== "graph") {
    return { kind: "ignored" }
  }
  return readGraphKeyboardInputResult(context.input)
}

export function readGraphKeyboardContextResult(
  context: Omit<GraphKeyboardContextInput, "input">,
  event: KeyboardEvent,
): GraphKeyboardResult {
  return readGraphKeyboardContextInputResult({
    ...context,
    input: {
      key: event.key,
      repeat: event.repeat,
      defaultPrevented: event.defaultPrevented,
      isComposing: event.isComposing,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      targetKind: readKeyboardTargetKind(event.target),
    },
  })
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled graph keyboard action: ${String(value)}`)
}

function shouldIgnoreKeyboardInput(input: GraphKeyboardInput): boolean {
  return (
    input.defaultPrevented === true ||
    input.isComposing === true ||
    input.ctrlKey === true ||
    input.metaKey === true ||
    input.altKey === true ||
    input.shiftKey === true ||
    isInteractiveTargetKind(input.targetKind)
  )
}

function readKeyAction(key: string): GraphKeyboardAction | null {
  switch (key.toLowerCase()) {
    case " ":
    case "space":
    case "spacebar":
      return "playPause"
    case "r":
      return "replay"
    case "q":
      return "seekBackward"
    case "e":
      return "seekForward"
    case "w":
      return "toggleBigProgressBar"
    default:
      return null
  }
}

function allowsRepeat(action: GraphKeyboardAction): boolean {
  switch (action) {
    case "playPause":
    case "replay":
    case "toggleBigProgressBar":
      return false
    case "seekBackward":
    case "seekForward":
      return true
    default:
      return assertNever(action)
  }
}

function isInteractiveTargetKind(targetKind: GraphKeyboardTargetKind | undefined): boolean {
  return targetKind !== undefined && targetKind !== "neutral"
}

function readKeyboardTargetKind(target: EventTarget | null): GraphKeyboardTargetKind {
  if (!(target instanceof Element)) {
    return "neutral"
  }
  if (target.closest("button,a,[role='button']")) {
    return "button"
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return "input"
  }
  for (let element: Element | null = target; element; element = element.parentElement) {
    if (element instanceof HTMLElement && element.isContentEditable) {
      return "contentEditable"
    }
  }
  return "neutral"
}
