/**
 * set-workspace.mjs
 *
 * Ustawia aktywny workspace dla narzędzi MCP (generate_bpmn itp.)
 * bez konieczności restartu serwera.
 *
 * Użycie:
 *   node scripts/set-workspace.mjs C:/projects/moj-projekt
 *   npm run workspace -- C:/projects/moj-projekt
 *
 * Zapisuje ścieżkę do mcp-workspace.json (odczytywany przy każdym wywołaniu narzędzia).
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_FILE = join(__dirname, '..', 'mcp-workspace.json')

const newPath = process.argv[2]

if (!newPath) {
  // Wyświetl aktualny stan gdy brak argumentu
  if (existsSync(CONFIG_FILE)) {
    const current = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
    console.log(`📁 Aktualny workspace: ${current.workspace_root}`)
    console.log(`   Ustawiony: ${current.set_at}`)
  } else {
    console.log('ℹ️  Brak aktywnego workspace (mcp-workspace.json nie istnieje).')
    console.log('   Używana jest zmienna MCP_WORKSPACE_ROOT z .env')
  }
  console.log('\nUżycie: npm run workspace -- <ścieżka>')
  process.exit(0)
}

const absolutePath = resolve(newPath)

const config = {
  workspace_root: absolutePath,
  set_at: new Date().toISOString(),
}

writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8')

console.log(`✅ MCP workspace ustawiony na: ${absolutePath}`)
console.log(`   Zapisano do: mcp-workspace.json`)
console.log(`   Serwer nie wymaga restartu – zmiana aktywna natychmiast.`)
