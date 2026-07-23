import assert from "node:assert/strict"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"

const fixtureDir = path.join(tmpdir(), "graph-animation-controller-keyboard-tests")
const bundledModule = path.join(fixtureDir, "keyboardShortcuts.mjs")

await rm(fixtureDir, { recursive: true, force: true })
await mkdir(fixtureDir, { recursive: true })
await build({
  bundle: true,
  entryPoints: ["src/keyboardShortcuts.ts"],
  external: ["obsidian"],
  format: "esm",
  outfile: bundledModule,
  platform: "node",
  target: "node18",
})
await writeFile(path.join(fixtureDir, "package.json"), JSON.stringify({ type: "module" }))

const { readGraphKeyboardContextInputResult, readGraphKeyboardInputResult } = await import(
  pathToFileURL(bundledModule).href
)

test("accepts a neutral document target while the global graph is active", () => {
  // Given: a keydown originating from the document body while the global graph owns the active leaf.
  const context = {
    enabled: true,
    activeViewType: "graph",
    input: { key: "w", targetKind: "neutral" },
  }

  // When: the graph shortcut context parser reads the event.
  const result = readGraphKeyboardContextInputResult(context)

  // Then: the active graph receives the action even though the body is outside its view-content element.
  assert.deepEqual(result, { kind: "action", action: "toggleBigProgressBar" })
})

test("maps graph shortcut keys when recognized", () => {
  // Given: keyboard input records for every supported shortcut spelling.
  const cases = [
    [" ", "playPause"],
    ["Space", "playPause"],
    ["Spacebar", "playPause"],
    ["r", "replay"],
    ["R", "replay"],
    ["q", "seekBackward"],
    ["Q", "seekBackward"],
    ["e", "seekForward"],
    ["E", "seekForward"],
    ["w", "toggleBigProgressBar"],
    ["W", "toggleBigProgressBar"],
  ]

  for (const [key, expected] of cases) {
    // When: the pure parser reads the key.
    const result = readGraphKeyboardInputResult({ key })

    // Then: it returns the graph action consumed by the executor.
    assert.deepEqual(result, { kind: "action", action: expected })
  }
})

test("consumes repeated non-seek shortcuts without producing actions", () => {
  // Given: repeated keyboard inputs for every supported action.
  const cases = [
    [" ", { kind: "consumed" }],
    ["r", { kind: "consumed" }],
    ["w", { kind: "consumed" }],
    ["q", { kind: "action", action: "seekBackward" }],
    ["e", { kind: "action", action: "seekForward" }],
  ]

  for (const [key, expected] of cases) {
    // When: the parser reads a repeated keydown.
    const result = readGraphKeyboardInputResult({ key, repeat: true })

    // Then: Space/R/W are consumed to prevent leakage, while Q/E keep producing actions.
    assert.deepEqual(result, expected)
  }
})

test("ignores unrecognized keys", () => {
  // Given: a neutral keyboard input outside the graph shortcut set.
  const input = { key: "x" }

  // When: the parser reads the key.
  const result = readGraphKeyboardInputResult(input)

  // Then: it ignores the event rather than consuming it.
  assert.deepEqual(result, { kind: "ignored" })
})

test("ignores shortcuts with modifiers or consumed keydown state", () => {
  // Given: keyboard inputs that should not trigger graph actions.
  const blockedInputs = [
    { key: "q", ctrlKey: true },
    { key: "q", metaKey: true },
    { key: "q", altKey: true },
    { key: "q", shiftKey: true },
    { key: "q", defaultPrevented: true },
    { key: "q", isComposing: true },
  ]

  for (const input of blockedInputs) {
    // When: the parser reads a shortcut key with an ignore guard active.
    const result = readGraphKeyboardInputResult(input)

    // Then: it does not produce a graph action.
    assert.deepEqual(result, { kind: "ignored" })
  }
})

test("ignores editable and command targets inside a graph without DOM construction", () => {
  // Given: pure target classifications from the thin DOM adapter.
  const blockedTargets = ["button", "input", "contentEditable"]

  for (const targetKind of blockedTargets) {
    // When: the parser reads a shortcut from an interactive target.
    const result = readGraphKeyboardInputResult({ key: "q", targetKind })

    // Then: it does not produce a graph action.
    assert.deepEqual(result, { kind: "ignored" })
  }
})
