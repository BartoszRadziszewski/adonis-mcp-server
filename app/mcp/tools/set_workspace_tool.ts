import type { ToolContext } from '@jrmc/adonis-mcp/types/context'
import type { BaseSchema } from '@jrmc/adonis-mcp/types/method'
import { Tool } from '@jrmc/adonis-mcp'
import { writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

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
    // Brak argumentu → zwróć aktualny stan
    if (!args?.workspace_root) {
      const current = await readWorkspaceConfig()
      if (current) {
        return response.text(
          `📁 Aktualny workspace: ${current}\n` +
            `   (źródło: mcp-workspace.json)\n\n` +
            `Aby zmienić: set_workspace(workspace_root: "<ścieżka>")`
        )
      }
      const envVal = process.env.MCP_WORKSPACE_ROOT
      if (envVal) {
        return response.text(
          `📁 Aktualny workspace: ${envVal}\n` +
            `   (źródło: MCP_WORKSPACE_ROOT w .env)\n\n` +
            `Aby zmienić bez restartu: set_workspace(workspace_root: "<ścieżka>")`
        )
      }
      return response.text(
        `⚠️  Brak ustawionego workspace.\n` +
          `Użyj: set_workspace(workspace_root: "C:/projects/twoj-projekt")`
      )
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
