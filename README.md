# Graph Animation Controller

Adds playback controls, speed control, seek buttons, and configurable date overlays to Obsidian's built-in graph timelapse animation.

## Features

- Pause/resume support that resumes from the current graph progression instead of restarting from the beginning.
- Configurable playback speed from settings and from a speed popover in the graph control bar.
- Configurable seek step for skip backward/forward buttons. The default is 10% of the graph timeline.
- Date overlay formats and placements, including compact corner styles and a large hero style.
- Exposed appearance options for date font family, size, weight, color, opacity, and background.

## Important caveat

Obsidian does not expose a public API for graph timelapse internals. This plugin patches private runtime objects such as `view.dataEngine.renderProgression()` and `progressionSpeed`. It is intentionally small and unload-safe, but it can break when Obsidian changes the core graph implementation.

## Potential issues and follow-up extensions

- Private API fragility: Obsidian updates may rename `dataEngine`, `renderer.nodes`, or `renderProgression()`.
- Local graph support is best-effort because local graph leaves may not expose the same data engine shape.
- Date source currently matches core graph ordering by using `min(ctime, mtime)`, not frontmatter.
- The plugin does not replace the graph timeline builder. A future frontmatter `created_at` source should cache parsed timestamps and invalidate on metadata changes.
- Keyboard pan/zoom speed is not patched because Obsidian keeps those speeds in local variables inside the renderer frame loop.
- Future controls could add a scrubber timeline, presets, per-vault style profiles, and optional export of the timelapse as a video.
