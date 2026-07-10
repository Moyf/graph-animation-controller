# Obsidian Graph Timelapse Animation Internals

> Status: reference note  
> Updated: 2026-07-09  
> Scope: Obsidian desktop core Graph view, runtime scripting / plugin experimentation

This note records the runtime knowledge gathered while building `_global/scripts/ntbScripts/GraphAnimSpeed.js`: animation speed control, date overlay, and playback controls for Obsidian's core Graph timelapse animation.

The core Graph plugin has no public API for these features. Everything below touches private/minified internals and should be treated as version-sensitive.

## 1. Where the code lives

In the tested installation:

```text
D:\Apps\Obsidian\resources\obsidian.asar\app.js
```

Obsidian/Electron can read inside the asar at runtime:

```js
const fs = require("fs");
const content = fs.readFileSync(
  "D:\\Apps\\Obsidian\\resources\\obsidian.asar\\app.js",
  "utf8"
);
```

Useful search anchors in the minified file:

- `mod-animate`
- `tooltipStartTimelapseAnimation`
- `renderProgression=function`
- `keyboardActions`
- `targetScale`

The graph animate button in core Graph controls is:

```text
clickable-icon graph-controls-button mod-animate
```

It calls:

```js
i.renderProgression()
```

where `i` is the graph data engine (`leaf.view.dataEngine`).

## 2. Accessing the Graph engine

Global graph:

```js
const leaf = app.workspace.getLeavesOfType("graph")[0];
const engine = leaf?.view?.dataEngine;
const renderer = engine?.renderer;
```

Local graph can exist as `localgraph`, but in testing it did not expose `view.dataEngine` in the same way. Always filter defensively:

```js
const leaves = [
  ...app.workspace.getLeavesOfType("graph"),
  ...app.workspace.getLeavesOfType("localgraph"),
].filter(l => l.view?.dataEngine);
```

Relevant properties observed:

```js
engine.progression       // timelapse cursor; 0 when stopped
engine.progressionSpeed  // cursor units per second
engine.renderer.nodes    // currently rendered nodes; ordered by creation timeline during timelapse
engine.renderer.nodeLookup
engine.render()          // renders current progression and returns maxLinks / total progression count
engine.renderProgression()
```

## 3. Core `renderProgression()` behavior

Minified source around `renderProgression` expands conceptually to:

```js
async function renderProgression() {
  this.progression = 1;
  const maxLinks = this.render();
  this.progressionSpeed = Math.clamp(0.5 * Math.sqrt(maxLinks), 5, 100);
  const t = Date.now();

  while (this.progression > 0) {
    const oldProgression = this.progression;
    await new Promise(resolve => setTimeout(resolve, 0));

    if (oldProgression !== this.progression) break;

    const next = 1 + Math.floor(this.progressionSpeed * (Date.now() - t) / 1000);
    if (next !== this.progression && (this.progression = next, this.render())) {
      continue;
    }
    break;
  }
}
```

Important implications:

1. `progressionSpeed` is assigned after `engine.render()` returns `maxLinks`.
2. `progression` is not a file index. It is a cursor over the graph construction count (nodes plus links / references counted by the render builder).
3. If external code changes `engine.progression`, the active loop detects `oldProgression !== this.progression` and exits.
4. `renderProgression()` always resets `progression = 1` unless patched.

## 4. Speed multiplier patch

The least invasive speed patch is to intercept the instance property `progressionSpeed` with an accessor. Core code assigns the base speed; the setter multiplies it.

```js
function patchEngine(engine, multiplier) {
  if (Object.prototype.hasOwnProperty.call(engine, "progressionSpeed")) {
    const rawVal = engine.progressionSpeed / (window._graphAnimSpeedMult || 1);
    delete engine.progressionSpeed;
    engine.progressionSpeed = rawVal;
  }

  window._graphAnimSpeedMult = multiplier;
  if (multiplier === 1) return;

  let value = engine.progressionSpeed;
  Object.defineProperty(engine, "progressionSpeed", {
    get: () => value,
    set: v => { value = v * (window._graphAnimSpeedMult || 1); },
    configurable: true,
  });
}
```

Why store the multiplier on `window`:

- It is a shared runtime state used by the accessor.
- It lets a later script invocation replace the multiplier without needing persistent plugin settings.
- It disappears on Obsidian restart.

## 5. Date source and timeline mapping

Core render sorts cached files by:

```js
Math.min(file.stat.ctime, file.stat.mtime)
```

Observed minified source:

```js
v[b] = w instanceof TFile ? Math.min(w.stat.ctime, w.stat.mtime) : Infinity;
m.sort((e, t) => v[e] - v[t]);
```

So the built-in timelapse uses filesystem stats, not frontmatter.

### Why direct `progression -> file[index]` is wrong

The first implementation mapped `progression` to a globally sorted file list. That lagged: nodes had finished rendering, but the date kept changing.

Root cause:

- `progression` can exceed the number of visible nodes.
- With a speed multiplier, `progression` can overshoot the render upper bound by a lot before the loop exits.

### Correct practical mapping

Use the current graph renderer and clamp to the true upper bound:

```js
const maxLinks = engine.render();       // true progression upper bound
const totalNodes = renderer.nodes.length;
const ratio = Math.min(engine.progression, maxLinks) / maxLinks;
const nodeIndex = Math.min(Math.floor(ratio * totalNodes), totalNodes - 1);
const node = renderer.nodes[nodeIndex];
```

Then derive the date from the node id:

```js
const file = app.vault.getAbstractFileByPath(node.id);
const ts = file?.stat ? Math.min(file.stat.ctime, file.stat.mtime) : null;
```

This stays synchronized when the animation completes because progression is clamped to `maxLinks`.

## 6. Date overlay implementation notes

Graph view DOM shape observed:

```text
.workspace-leaf
  .workspace-leaf-content
    .view-content
      canvas
      iframe
      .graph-controls
```

Target for injected UI:

```js
const viewContentEl = leaf.containerEl.querySelector(".view-content");
```

### Compact style

Small, fully opaque, lower-left, background/border:

```js
const OVERLAY_CSS_COMPACT = [
  "position: absolute", "bottom: 52px", "left: 12px", "z-index: 10",
  "font-size: 13px", "font-weight: 600", "font-variant-numeric: tabular-nums",
  "color: var(--text-muted)", "background: var(--background-primary)",
  "border: 1px solid var(--background-modifier-border)",
  "padding: 2px 8px", "border-radius: 4px",
  "pointer-events: none", "opacity: 0", "transition: opacity 0.15s",
].join("; ");
```

Compact text includes a date emoji:

```js
overlay.textContent = "📅 " + dateStr;
```

### Hero style

Large, centered above middle, semi-transparent, no emoji:

```js
const OVERLAY_CSS_HERO = [
  "position: absolute", "top: 18%", "left: 50%", "transform: translateX(-50%)",
  "font-size: 48px", "font-weight: 700", "letter-spacing: 0.04em",
  "font-variant-numeric: tabular-nums", "color: var(--text-normal)",
  "opacity: 0", "pointer-events: none", "white-space: nowrap",
  "font-family: var(--font-monospace)", "transition: opacity 0.15s",
].join("; ");
```

Hero is inserted before `canvas` so the graph canvas naturally covers it:

```js
const canvas = viewContentEl.querySelector("canvas");
canvas ? viewContentEl.insertBefore(overlay, canvas) : viewContentEl.prepend(overlay);
```

Runtime opacity:

```js
overlay.style.opacity = dateStyle === "compact" ? "1" : "0.18";
```

## 7. Playback controls

### Why a custom `renderProgression()` patch is needed

Pause is easy: set `engine.progression = 0` and the core loop exits.

Resume is not easy: core `renderProgression()` always sets `progression = 1`. To resume, patch the prototype to honor an internal `_resumeFrom` field:

```js
function patchRenderProgression(engine) {
  const proto = Object.getPrototypeOf(engine);
  if (proto._graphAnimPatched) return;
  proto._graphAnimPatched = true;
  proto._graphAnimOriginalRenderProgression = proto.renderProgression;

  proto.renderProgression = async function () {
    const startFrom = this._resumeFrom != null ? this._resumeFrom : 1;
    this._resumeFrom = null;

    const e = this.render();
    this.progressionSpeed = Math.clamp(0.5 * Math.sqrt(e), 5, 100);
    this.progression = startFrom;

    const elapsed0 = (startFrom - 1) / this.progressionSpeed * 1000;
    const t = Date.now() - elapsed0;

    while (this.progression > 0) {
      const n = this.progression;
      await new Promise(resolve => setTimeout(resolve, 0));
      if (n !== this.progression) break;
      const newN = 1 + Math.floor(this.progressionSpeed * (Date.now() - t) / 1000);
      if (newN === this.progression) continue;
      this.progression = newN;
      this.render();
    }
  };
}
```

The `elapsed0` backdates `t` so the first computed `newN` is aligned with the resume point.

### Seek behavior

Seek step used in the NTB script:

```js
const maxLinks = engine.render();
const step = Math.max(1, Math.floor(maxLinks * 0.1));
```

Paused seek:

```js
savedProgression = Math.min(Math.max(1, savedProgression + delta * step), maxLinks);
engine.progression = savedProgression;
engine.render();
```

Playing seek:

```js
const next = Math.min(Math.max(1, engine.progression + delta * step), maxLinks);
engine.progression = next;
engine._resumeFrom = next;
engine.renderProgression();
```

The restart is required because the existing loop exits when it detects external progression mutation.

### Controls DOM

Use independent button styles. Do not use `.graph-controls-button` on custom buttons: Obsidian / Extended Graph may apply `display: none` depending on graph-controls state.

```js
const BTN_STYLE = "display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:4px;cursor:pointer;color:var(--icon-color);";

const btnPlay = bar.createEl("div", {
  cls: "clickable-icon",
  attr: { style: BTN_STYLE, "aria-label": "暂停" },
});
setIcon(btnPlay, "lucide-pause");
```

Icons confirmed available through `require("obsidian").setIcon`:

- `lucide-pause`
- `lucide-play`
- `lucide-skip-back`
- `lucide-skip-forward`

## 8. Keyboard pan / zoom speed internals

Keyboard movement and zoom are handled inside the renderer frame loop using local variables, not instance properties.

Observed minified logic:

```js
var C = shift ? 3 : 1;
renderer.panvX = mQ(v, w * C, 0.9);
renderer.panvY = mQ(g, k * C, 0.9);

var E = 1 + (shift ? 0.1 : 0.03);
if (keyboardActions.zoomin)  renderer.targetScale *= E;
if (keyboardActions.zoomout) renderer.targetScale /= E;
```

Because `C` and `E` are locals, they cannot be patched with `defineProperty`. Changing keyboard pan/zoom speed requires replacing or proxying a larger renderer frame function. This is possible but more fragile than `progressionSpeed`.

## 9. Frontmatter `created_at` idea

Current timelapse date source is filesystem stats:

```js
Math.min(file.stat.ctime, file.stat.mtime)
```

Using Markdown frontmatter `created_at` would require replacing more of the core `render()` timeline build. Performance notes:

- For large vaults, reading and parsing frontmatter for every cached file can be expensive.
- `metadataCache.getFileCache(file)?.frontmatter?.created_at` is memory-backed, but date parsing over tens of thousands of files still costs real time.
- If implemented, cache parsed timestamps and invalidate on metadata/file change events.

Recommendation: do not override timeline source unless the user explicitly needs semantic `created_at` ordering.

## 10. Review findings from the current NTB script

Findings from the 2026-07-09 review:

1. **Fixed: seek while playing could stop the loop.**  
   Core loop exits when external code changes `progression`. The script now sets `_resumeFrom = next` and calls `renderProgression()` after playing seek.

2. **Fixed: custom controls inherited hidden graph-control CSS.**  
   Buttons originally used `graph-controls-button`; that class can be `display:none`. The script now uses `clickable-icon` plus inline sizing styles.

3. **Acceptable risk: prototype patch is global.**  
   `renderProgression` is patched on the data engine prototype, so it affects all graph engines in the running app. This is intended for the session but should be documented and kept small.

4. **Acceptable risk: no unload restoration in NTB script.**  
   NTB scripts have no plugin unload lifecycle. Runtime patches reset on Obsidian restart. A full plugin version should restore `proto._graphAnimOriginalRenderProgression` on unload.

5. **Acceptable tradeoff: `engine.render()` is called for maxLinks.**  
   It is called when animation starts and on seek. This is simpler and accurate. Avoid calling it every animation frame.

## 11. Verification commands

Check open graph leaves:

```powershell
obsidian.com eval code="JSON.stringify(app.workspace.getLeavesOfType('graph').map(l => !!l.view.dataEngine))"
```

Inspect controls existence / visibility:

```powershell
obsidian.com eval code="
const vc = app.workspace.getLeavesOfType('graph')[0]?.containerEl.querySelector('.view-content');
const bar = vc?.querySelector('#graph-anim-controls');
JSON.stringify({
  exists: !!bar,
  width: bar ? window.getComputedStyle(bar).width : null,
  buttons: bar ? Array.from(bar.children).map(b => window.getComputedStyle(b).display) : []
})
"
```

Check hero overlay is behind canvas:

```powershell
obsidian.com eval code="
const vc = app.workspace.getLeavesOfType('graph')[0]?.containerEl.querySelector('.view-content');
const children = Array.from(vc.children).map(c => c.id || c.tagName);
JSON.stringify(children)
"
```

Expected: `graph-anim-date-overlay` appears before `CANVAS` for hero mode.

## 12. Current script location

Vault script:

```text
H:\Docs\Obsinote\_global\scripts\ntbScripts\GraphAnimSpeed.js
```

Note Toolbar callout:

```md
> [!note-toolbar] Graph 动画速度
> - [Graph 动画速度]()<data data-javascript="exec" data-src="_global/scripts/ntbScripts/GraphAnimSpeed.js"/>
```
