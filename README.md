# Graph Animation Controller

Playback controls, timeline navigation, and customizable date overlays for Obsidian's built-in graph timelapse.

> [!IMPORTANT]
> This is a desktop-only plugin. It requires Obsidian 1.5.0 or later.

## Features

- **Reliable pause and resume**: continue from the current graph progression instead of restarting the animation.
- **Timeline controls**: replay, skip backward, skip forward, or jump to an exact percentage of the graph timeline.
- **Adjustable playback speed**: choose a speed from the graph controls or enter a custom multiplier from `0.1x` to `10x`.
- **Date overlays**: display the current timelapse date as `YYYY-MM-DD`, a localized date, a localized date and time, `YYYY-MM`, or `YYYY`.
- **Flexible placement**: position the date in any corner or use the large centered hero style.
- **Appearance controls**: customize the date scale, font family, font weight, text color, background, and opacity.
- **Optional keyboard controls**: control the animation without leaving the global graph view.

## Installation

### From Obsidian Community Plugins

Once the plugin is available in the Obsidian community directory:

1. Open **Settings → Community plugins**.
2. Select **Browse** and search for **Graph Animation Controller**.
3. Select **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Moyf/graph-animation-controller/releases/latest).
2. Create this folder inside your vault:

   ```text
   <vault>/.obsidian/plugins/graph-animation-controller/
   ```

3. Copy the downloaded files into that folder.
4. Restart Obsidian or reload the app.
5. Open **Settings → Community plugins** and enable **Graph Animation Controller**.

## Usage

1. Open Obsidian's **Graph view**.
2. Start the built-in timelapse animation.
3. Use the added controls to replay, seek, pause or resume, and change the playback speed.
4. Select the date overlay to open the timeline and position controls.

The plugin settings are available under **Settings → Graph Animation Controller**. You can configure seek distances, timeline step size, date formatting and placement, appearance, and keyboard controls there.

## Keyboard controls

Keyboard controls are disabled by default. Enable them in the plugin settings before use.

| Key | Action |
| --- | --- |
| `Space` | Play or pause |
| `R` | Replay from the beginning |
| `Q` | Seek backward |
| `E` | Seek forward |
| `W` | Show or hide the large progress bar above the toolbar |

Shortcuts only apply while the global graph view is active. They are ignored while typing in inputs and other editable controls.

## Compatibility and limitations

Obsidian does not provide a public API for graph timelapse internals. This plugin therefore integrates with private runtime objects such as `dataEngine`, `progressionSpeed`, and `renderProgression()`. An Obsidian update may change these internals and temporarily break the plugin.

Additional limitations:

- Only the global graph view is supported. Local graph views may expose a different runtime structure.
- Timeline dates follow Obsidian's graph ordering and use the earlier of each file's creation and modification timestamps. Frontmatter dates are not used.
- Keyboard pan and zoom speed are not modified.

If an Obsidian update causes a regression, please [open an issue](https://github.com/Moyf/graph-animation-controller/issues) and include your Obsidian version and operating system.

## Development

Requirements:

- Node.js 18 or later
- npm

Install dependencies and create a production build:

```bash
npm install
npm run build
```

Build artifacts are written to `dist/`:

```text
dist/
├── main.js
├── manifest.json
└── styles.css
```

For development, run the esbuild watcher:

```bash
npm run dev
```

## Contributing

Bug reports and focused pull requests are welcome. Before submitting a change, make sure `npm run build` completes successfully and describe how the behavior was verified in Obsidian.

## License

Released under the [MIT License](LICENSE).

## More from Moy

If you appreciate my plugin design and quality, check out my other Obsidian plugins:

| Plugin name | Description | Stats |
| --- | --- | --- |
| [Keyword Decorator](https://github.com/Moyf/keyword-decorator) | Keyword highlighting and decoration with Emoji/Lucide/image/SVG markers and once-per-note decoration. <!-- Draft; pending Moy review. --> | [![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&logoColor=white&color=%23483699&label=downloads&query=%24%5B%22keyword-decorator%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=keyword-decorator) [![GitHub Stars](https://img.shields.io/github/stars/Moyf/keyword-decorator?logo=github&label=Stars)](https://github.com/Moyf/keyword-decorator/stargazers) |

> See all my plugins on my [Obsidian Community page](https://community.obsidian.md/users/moyf).
