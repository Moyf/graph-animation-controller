import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const manifestPath = join(scriptDir, "..", "dist", "manifest.json")
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const pluginId = manifest.id
const localPluginPath = join("H:", "Docs", "Obsinote", ".obsidian", "plugins", pluginId)

mkdirSync(localPluginPath, { recursive: true })

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  const source = join(scriptDir, "..", "dist", file)
  if (existsSync(source)) {
    copyFileSync(source, join(localPluginPath, file))
  }
}

const hotReloadPath = join(localPluginPath, ".hotreload")
if (!existsSync(hotReloadPath)) {
  writeFileSync(hotReloadPath, "")
}

console.log(`Copied ${pluginId} to ${localPluginPath}`)
