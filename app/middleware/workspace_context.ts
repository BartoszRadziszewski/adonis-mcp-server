/**
 * workspace_context.ts
 *
 * AsyncLocalStorage przechowujący aktywny workspace przez czas trwania
 * pojedynczego żądania HTTP. Wypełniany przez WorkspaceMiddleware
 * z nagłówka X-Workspace-Root.
 *
 * Dzięki temu każdy projekt może mieć własny .mcp.json z inną ścieżką
 * i serwer automatycznie obsługuje właściwy katalog bez restartu.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export const workspaceStorage = new AsyncLocalStorage<string>()
