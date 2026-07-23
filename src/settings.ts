import { App, PluginSettingTab, Setting } from "obsidian"
import {
  DATE_FORMATS,
  DATE_POSITIONS,
  type DateFormat,
  type DatePosition,
  type GraphAnimationControllerSettings,
} from "./types"
import type GraphAnimationControllerPlugin from "../main"

type SettingKey = keyof GraphAnimationControllerSettings

export class GraphAnimationSettingTab extends PluginSettingTab {
  readonly #plugin: GraphAnimationControllerPlugin

  constructor(app: App, plugin: GraphAnimationControllerPlugin) {
    super(app, plugin)
    this.#plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    this.#addPlaybackSettings(containerEl)
    this.#addDateSettings(containerEl)
    this.#addAppearanceSettings(containerEl)
  }

  #addPlaybackSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("Playback speed")
      .setDesc("Multiplier applied to the graph timelapse speed.")
      .addSlider((slider) =>
        slider
          .setLimits(0.1, 10, 0.1)
          .setValue(this.#plugin.settings.speedMultiplier)
          .setDynamicTooltip()
          .onChange((value) => this.#updateSetting("speedMultiplier", value)),
      )

    new Setting(containerEl)
      .setName("Seek step")
      .setDesc("Percentage of the full graph timeline skipped by the back and forward buttons.")
      .addSlider((slider) =>
        slider
          .setLimits(1, 50, 1)
          .setValue(this.#plugin.settings.seekStepPercent)
          .setDynamicTooltip()
          .onChange((value) => this.#updateSetting("seekStepPercent", value)),
      )

    new Setting(containerEl)
      .setName("Progression slider step")
      .setDesc("Step size for the graph progression slider in the date menu.")
      .addSlider((slider) =>
        slider
          .setLimits(1, 20, 1)
          .setValue(this.#plugin.settings.progressionSliderStepPercent)
          .setDynamicTooltip()
          .onChange((value) => this.#updateSetting("progressionSliderStepPercent", value)),
      )

    new Setting(containerEl)
      .setName("Show replay button")
      .setDesc("Adds a replay button to the left side of the graph control bar.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.#plugin.settings.showReplayButton)
          .onChange((value) => this.#updateSetting("showReplayButton", value)),
      )

    new Setting(containerEl)
      .setName("Enable keyboard shortcuts")
      .setDesc(
        "Play/pause with Space, replay with R, seek backward with Q, seek forward with E, and toggle the progress bar with W. Only active while the global graph view is focused.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.#plugin.settings.enableKeyboardShortcuts)
          .onChange((value) => this.#updateSetting("enableKeyboardShortcuts", value)),
      )
  }

  #addDateSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Date display").setHeading()

    new Setting(containerEl)
      .setName("Date format")
      .setDesc("Controls how the current timelapse date is shown.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(DATE_FORMATS)
          .setValue(this.#plugin.settings.dateFormat)
          .onChange((value) => this.#updateSetting("dateFormat", parseDateFormat(value))),
      )

    new Setting(containerEl)
      .setName("Date position")
      .setDesc("Moves the overlay around the graph, including a large hero style.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(DATE_POSITIONS)
          .setValue(this.#plugin.settings.datePosition)
          .onChange((value) => this.#updateSetting("datePosition", parseDatePosition(value))),
      )

    new Setting(containerEl)
      .setName("Show progress percentage")
      .setDesc("Shows timeline progress from earliest date as 0% to latest date as 100%.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.#plugin.settings.showProgressPercent)
          .onChange((value) => this.#updateSetting("showProgressPercent", value)),
      )

    new Setting(containerEl)
      .setName("Show compact emoji")
      .setDesc("Adds a calendar emoji before compact date overlays.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.#plugin.settings.showEmojiInCompact)
          .onChange((value) => this.#updateSetting("showEmojiInCompact", value)),
      )
  }

  #addAppearanceSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Appearance").setHeading()

    new Setting(containerEl)
      .setName("Date scale")
      .setDesc("Scales the selected date style instead of forcing one shared font size.")
      .addSlider((slider) =>
        slider
          .setLimits(0.5, 2.5, 0.05)
          .setValue(this.#plugin.settings.dateScale)
          .setDynamicTooltip()
          .onChange((value) => this.#updateSetting("dateScale", value)),
      )

    new Setting(containerEl)
      .setName("Advanced options")
      .setDesc("Font family, weight, color, background, and opacity.")
      .addButton((button) =>
        button
          .setButtonText(this.#plugin.settings.showAdvancedAppearance ? "Hide" : "Show")
          .onClick(async () => {
            await this.#updateSetting("showAdvancedAppearance", !this.#plugin.settings.showAdvancedAppearance)
            this.display()
          }),
      )

    if (!this.#plugin.settings.showAdvancedAppearance) {
      return
    }

    new Setting(containerEl)
      .setName("Date font family")
      .setDesc("CSS font family for the date overlay.")
      .addText((text) =>
        text
          .setPlaceholder("var(--font-monospace)")
          .setValue(this.#plugin.settings.dateFontFamily)
          .onChange((value) => this.#updateSetting("dateFontFamily", value.trim() || "var(--font-monospace)")),
      )

    new Setting(containerEl)
      .setName("Date font weight")
      .setDesc("CSS numeric font weight.")
      .addSlider((slider) =>
        slider
          .setLimits(300, 900, 100)
          .setValue(this.#plugin.settings.dateFontWeight)
          .setDynamicTooltip()
          .onChange((value) => this.#updateSetting("dateFontWeight", value)),
      )

    new Setting(containerEl)
      .setName("Date color")
      .setDesc("CSS color value for the date text.")
      .addText((text) =>
        text
          .setPlaceholder("var(--text-muted)")
          .setValue(this.#plugin.settings.dateColor)
          .onChange((value) => this.#updateSetting("dateColor", value.trim() || "var(--text-muted)")),
      )

    new Setting(containerEl)
      .setName("Date background")
      .setDesc("CSS background for compact date overlays.")
      .addText((text) =>
        text
          .setPlaceholder("var(--background-primary)")
          .setValue(this.#plugin.settings.dateBackground)
          .onChange((value) =>
            this.#updateSetting("dateBackground", value.trim() || "var(--background-primary)"),
          ),
      )

    new Setting(containerEl)
      .setName("Date opacity")
      .setDesc("Overlay opacity from transparent to fully opaque.")
      .addSlider((slider) =>
        slider
          .setLimits(0.05, 1, 0.05)
          .setValue(this.#plugin.settings.dateOpacity)
          .setDynamicTooltip()
          .onChange((value) => this.#updateSetting("dateOpacity", value)),
      )
  }

  async #updateSetting<Key extends SettingKey>(
    key: Key,
    value: GraphAnimationControllerSettings[Key],
  ): Promise<void> {
    await this.#plugin.updateSettings({ ...this.#plugin.settings, [key]: value })
  }
}

function parseDateFormat(value: string): DateFormat {
  return value in DATE_FORMATS ? (value as DateFormat) : "iso"
}

function parseDatePosition(value: string): DatePosition {
  return value in DATE_POSITIONS ? (value as DatePosition) : "bottomLeft"
}
