import type { ToolContext } from '@jrmc/adonis-mcp/types/context'
import type { BaseSchema } from '@jrmc/adonis-mcp/types/method'

import { Tool } from '@jrmc/adonis-mcp'
import vine from '@vinejs/vine'

type Schema = BaseSchema<{
  name: { type: "string" }
}>

const vineSchema = vine.object({
  name: vine.string().meta({
    description: 'Description text argument',
  }),
})

export default class HelloWorldTool extends Tool<Schema> {
  name = 'hello_world'
  title = 'Tool title'
  description = 'Tool description'

  async handle({ args, response }: ToolContext<Schema>) {
    return response.text(`Hello, ${args?.name}`)
  }

  schema() {
    return vine.create(vineSchema).toJSONSchema() as Schema
  }
}