import type { ToolContext } from '@jrmc/adonis-mcp/types/context'
import type { BaseSchema } from '@jrmc/adonis-mcp/types/method'
import { Tool } from '@jrmc/adonis-mcp'
import { writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { workspaceStorage } from '#middleware/workspace_context'

type Schema = BaseSchema<{
  workspace_root: { type: 'string' }
}>

// Ścieżka do pliku konfiguracyjnego – obok serwera, niezależna od projektu
const CONFIG_PATH = join(process.cwd(), 'mcp-workspace.json')

export async function readWorkspaceConfig(): Promise<string | null> {
  if (!existsSync(CONFIG_PATH)) return null
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    const cfg = JSON.parse(raw)
    return cfg.workspace_root || null
  } catch {
    return null
  }
}

export default class SetWorkspaceTool extends Tool<Schema> {
  name = 'set_workspace'
  title = 'Ustaw aktywny workspace'
  description =
    'Ustawia katalog projektu używany przez pozostałe narzędzia MCP (generate_bpmn itp.). ' +
    'Wywołaj raz na początku pracy z nowym projektem – zmiana jest natychmiastowa, serwer nie wymaga restartu. ' +
    'Bez argumentu – zwraca aktualnie ustawiony workspace.'

  async handle({ args, response }: ToolContext<Schema>) {
    // Brak argumentu → zwróć aktualny stan (pokaż wszystkie źródła)
    if (!args?.workspace_root) {
      const fromHeader = workspaceStorage.getStore()
      const fromFile = await readWorkspaceConfig()
      const fromEnv = process.env.MCP_WORKSPACE_ROOT

      const active = fromHeader || fromFile || fromEnv

      const lines: string[] = []
      if (active) {
        lines.push(`📁 Aktywny workspace: ${active}`)
        lines.push(``)
      }
      lines.push(`Źródła (priorytet malejąco):`)
      lines.push(`  1. X-Workspace-Root header: ${fromHeader ? `✅ ${fromHeader}` : '—'}`)
      lines.push(`  2. mcp-workspace.json:       ${fromFile  ? `✅ ${fromFile}`   : '—'}`)
      lines.push(`  3. MCP_WORKSPACE_ROOT (.env):${fromEnv   ? ` ✅ ${fromEnv}`   : ' —'}`)
      if (!active) {
        lines.push(``)
        lines.push(`⚠️  Brak workspace. Dodaj nagłówek do .mcp.json projektu:`)
        lines.push(`  "headers": { "X-Workspace-Root": "C:/projects/twoj-projekt" }`)
      }

      return response.text(lines.join('\n'))
    }

    const newPath = args.workspace_root.trim()

    const config = {
      workspace_root: newPath,
      set_at: new Date().toISOString(),
    }

    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')

    return response.text(
      `✅ Workspace ustawiony: ${newPath}\n\n` +
        `Zmiana aktywna natychmiast – serwer nie wymaga restartu.\n` +
        `Teraz możesz wywołać generate_bpmn bez podawania workspace_root.`
    )
  }

  schema() {
    return {
      type: 'object',
      properties: {
        workspace_root: {
          type: 'string',
          description:
            'Absolutna ścieżka do katalogu projektu, np. "C:/projects/moj-projekt". ' +
            'Pomiń argument aby sprawdzić aktualnie ustawiony workspace.',
        },
      },
      required: [],
    } as Schema
  }
}
