/*
|--------------------------------------------------------------------------
| MCP Tools Registration
|--------------------------------------------------------------------------
|
| Ręczna rejestracja narzędzi MCP – niezawodna alternatywa dla auto-discovery.
| Dodaj tutaj każdy nowy tool.
|
*/

import app from '@adonisjs/core/services/app'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

app.ready(async () => {
  const server = await app.container.make('jrmc.mcp')

  // Lista toolsów z ich ścieżkami
  const toolFiles = [
    'generate_bpmn_tool',
    'hello_world_tool',
  ]

  const toolsDir = join(app.appRoot.pathname.replace(/^\/([A-Z]:)/, '$1'), 'app', 'mcp', 'tools')

  for (const fileName of toolFiles) {
    const tsPath = join(toolsDir, `${fileName}.ts`)
    const fileUrl = pathToFileURL(tsPath).href
    const { default: ToolClass } = await import(fileUrl)
    const instance = new ToolClass()
    // @ts-ignore
    server.addTool({ [instance.name]: { path: fileUrl, json: instance.toJson() } })
    console.log('[mcp] registered tool:', instance.name)
  }
})
