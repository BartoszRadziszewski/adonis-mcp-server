import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { workspaceStorage } from './workspace_context.js'

/**
 * WorkspaceMiddleware
 *
 * Odczytuje nagłówek X-Workspace-Root z każdego żądania HTTP i zapisuje
 * wartość w AsyncLocalStorage na czas trwania żądania.
 *
 * Narzędzia MCP (generate_bpmn itp.) automatycznie używają tej wartości
 * jako katalogu projektu – bez żadnego ręcznego przełączania.
 *
 * Konfiguracja po stronie projektu (.mcp.json):
 *
 *   {
 *     "mcpServers": {
 *       "adonis-mcp-server": {
 *         "type": "http",
 *         "url": "http://localhost:3333/mcp",
 *         "headers": {
 *           "X-Workspace-Root": "C:/projects/twoj-projekt"
 *         }
 *       }
 *     }
 *   }
 */
export default class WorkspaceMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const headerValue = ctx.request.header('x-workspace-root')

    if (headerValue) {
      // Uruchom resztę żądania w kontekście tego workspace
      return workspaceStorage.run(headerValue.trim(), () => next())
    }

    // Brak nagłówka – kontynuuj bez nadpisywania (narzędzie sięgnie po fallback)
    return next()
  }
}
