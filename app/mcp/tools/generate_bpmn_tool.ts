import type { ToolContext } from '@jrmc/adonis-mcp/types/context'
import type { BaseSchema } from '@jrmc/adonis-mcp/types/method'
import { Tool } from '@jrmc/adonis-mcp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, basename, extname } from 'node:path'


type Schema = BaseSchema<{
  source_path: { type: 'string' }
  output_path: { type: 'string' }
}>

interface ProcessStep {
  id: string
  name: string
  area: string
  activities: string
  systems: string
  next: string
  trigger: string
  docs: string
}

interface ProcessMeta {
  id: string
  title: string
  type: string
  date: string
  steps: ProcessStep[]
}

function getTableAttr(body: string, attr: string): string {
  const re = new RegExp(`\\|\\s*${attr}\\s*\\|\\s*(.+?)\\s*\\|`)
  const m = body.match(re)
  return m ? m[1].replace(/\*\*/g, '').trim() : ''
}

function parseMarkdown(content: string): ProcessMeta {
  const titleMatch = content.match(/^# (.+)/m)
  const title = titleMatch ? titleMatch[1].trim() : 'Process'
  const idMatch = title.match(/^([A-Z]+-\d+)/)
  const processId = idMatch ? idMatch[1].replace('-', '_') : 'proc_001'

  const typeMatch = content.match(/\*\*Typ:\*\* (.+)/)
  const dateMatch = content.match(/\*\*Data udokumentowania:\*\* (.+)/)

  const steps: ProcessStep[] = []
  // Match each step block: ### S{n} – {name} ... until next ### S or section boundary
  const stepRegex = /### (S\d+)([^\n]*)\n([\s\S]+?)(?=\n### S\d+|\n---|\n## |$)/g
  let m: RegExpExecArray | null

  while ((m = stepRegex.exec(content)) !== null) {
    const body = m[3]
    const rawHeader = m[2].trim()
    const name = rawHeader.includes('–') ? rawHeader.split('–').slice(1).join('–').trim() : rawHeader
    steps.push({
      id: m[1],
      name,
      area: getTableAttr(body, 'Obszar'),
      activities: getTableAttr(body, 'Czynności'),
      systems: getTableAttr(body, 'Systemy'),
      next: getTableAttr(body, 'Następny'),
      trigger: getTableAttr(body, 'Wyzwalacz'),
      docs: getTableAttr(body, 'Dokumenty'),
    })
  }

  return {
    id: processId,
    title,
    type: typeMatch ? typeMatch[1].trim() : 'As-Is',
    date: dateMatch ? dateMatch[1].trim() : '',
    steps,
  }
}

function sid(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase()
}

function x(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface LayoutNode {
  xmlId: string
  type: 'startEvent' | 'task' | 'endEvent' | 'parallelGateway' | 'exclusiveGateway'
  name: string
  lane: string
  col: number
}

interface LayoutEdge {
  id: string
  source: string
  target: string
  name?: string
}

function generateBpmn(meta: ProcessMeta): string {
  const { id, title, steps } = meta

  // Collect unique lane names preserving order
  const laneNames: string[] = []
  steps.forEach((s) => {
    const a = s.area || 'Proces'
    if (!laneNames.includes(a)) laneNames.push(a)
  })
  if (laneNames.length === 0) laneNames.push('Proces')

  const laneId = (name: string) => `lane_${sid(name)}`

  // Build node list
  const nodes: LayoutNode[] = []
  const firstArea = steps[0]?.area || laneNames[0]
  const lastArea = steps[steps.length - 1]?.area || laneNames[laneNames.length - 1]

  nodes.push({ xmlId: 'se_start', type: 'startEvent', name: steps[0]?.trigger || 'Start', lane: firstArea, col: 0 })

  let col = 1
  steps.forEach((step) => {
    nodes.push({
      xmlId: `task_${sid(step.id)}`,
      type: 'task',
      name: `${step.id} – ${step.name}`,
      lane: step.area || laneNames[0],
      col: col++,
    })

    const hasAnd = /AND|równolegle/i.test(step.next)
    const hasXor = /XOR|wyłącznie|decyzja/i.test(step.next)
    if (hasAnd) {
      nodes.push({ xmlId: `gw_and_${sid(step.id)}`, type: 'parallelGateway', name: '', lane: step.area || laneNames[0], col: col++ })
    } else if (hasXor) {
      nodes.push({ xmlId: `gw_xor_${sid(step.id)}`, type: 'exclusiveGateway', name: '', lane: step.area || laneNames[0], col: col++ })
    }
  })

  nodes.push({ xmlId: 'ee_end', type: 'endEvent', name: 'Koniec procesu', lane: lastArea, col: col })

  // Build simple linear sequence flows
  const edges: LayoutEdge[] = []
  const mainFlow = nodes.filter((n) => !n.xmlId.startsWith('gw_'))
  for (let i = 0; i < mainFlow.length - 1; i++) {
    edges.push({ id: `sf_${i + 1}`, source: mainFlow[i].xmlId, target: mainFlow[i + 1].xmlId })
  }

  // Layout constants
  const POOL_X = 100
  const POOL_Y = 80
  const LANE_HEADER = 30
  const LANE_H = 160
  const COL_W = 220
  const TASK_W = 160
  const TASK_H = 80
  const EV_R = 18
  const GW_S = 50
  const MARGIN_LEFT = 80

  const totalCols = col + 1
  const poolW = LANE_HEADER + MARGIN_LEFT + totalCols * COL_W + 60
  const poolH = laneNames.length * LANE_H

  const getNodeX = (c: number) => POOL_X + LANE_HEADER + MARGIN_LEFT + c * COL_W
  const getLaneCY = (laneName: string) => {
    const idx = laneNames.indexOf(laneName)
    return POOL_Y + (idx < 0 ? 0 : idx) * LANE_H + LANE_H / 2
  }

  interface Rect { x: number; y: number; w: number; h: number }
  const pos = new Map<string, Rect>()

  nodes.forEach((n) => {
    const cx = getNodeX(n.col)
    const cy = getLaneCY(n.lane)
    if (n.type === 'startEvent' || n.type === 'endEvent') {
      pos.set(n.xmlId, { x: cx - EV_R, y: cy - EV_R, w: EV_R * 2, h: EV_R * 2 })
    } else if (n.type === 'parallelGateway' || n.type === 'exclusiveGateway') {
      pos.set(n.xmlId, { x: cx - GW_S / 2, y: cy - GW_S / 2, w: GW_S, h: GW_S })
    } else {
      pos.set(n.xmlId, { x: cx - TASK_W / 2, y: cy - TASK_H / 2, w: TASK_W, h: TASK_H })
    }
  })

  const lines: string[] = []
  const P = (s: string) => lines.push(s)

  P(`<?xml version="1.0" encoding="UTF-8"?>`)
  P(`<!-- Generated by adonis-mcp generate_bpmn | ${x(title)} | ${meta.date} -->`)
  P(`<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"`)
  P(`             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"`)
  P(`             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"`)
  P(`             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"`)
  P(`             typeLanguage="http://www.w3.org/2001/XMLSchema"`)
  P(`             expressionLanguage="http://www.w3.org/1999/XPath"`)
  P(`             targetNamespace="http://vive.com.pl/bpmn/${sid(id)}">`)
  P(``)
  P(`  <process id="proc_${sid(id)}" name="${x(title)}" isExecutable="false">`)
  P(``)
  P(`    <laneSet id="ls_${sid(id)}">`)

  laneNames.forEach((lane) => {
    P(`      <lane id="${laneId(lane)}" name="${x(lane)}">`)
    nodes
      .filter((n) => n.lane === lane || (!laneNames.includes(n.lane) && lane === laneNames[0]))
      .forEach((n) => P(`        <flowNodeRef>${n.xmlId}</flowNodeRef>`))
    P(`      </lane>`)
  })

  P(`    </laneSet>`)
  P(``)

  // Elements
  nodes.forEach((n) => {
    const na = n.name ? ` name="${x(n.name)}"` : ''
    if (n.type === 'startEvent') {
      P(`    <startEvent id="${n.xmlId}"${na}/>`)
    } else if (n.type === 'endEvent') {
      P(`    <endEvent id="${n.xmlId}"${na}/>`)
    } else if (n.type === 'parallelGateway') {
      P(`    <parallelGateway id="${n.xmlId}"${na}/>`)
    } else if (n.type === 'exclusiveGateway') {
      P(`    <exclusiveGateway id="${n.xmlId}"${na}/>`)
    } else {
      const step = steps.find((s) => n.xmlId === `task_${sid(s.id)}`)
      P(`    <task id="${n.xmlId}"${na}>`)
      if (step?.activities) P(`      <documentation>${x(step.activities)}</documentation>`)
      P(`    </task>`)
    }
  })

  P(``)

  edges.forEach((e) => {
    const na = e.name ? ` name="${x(e.name)}"` : ''
    P(`    <sequenceFlow id="${e.id}" sourceRef="${e.source}" targetRef="${e.target}"${na}/>`)
  })

  P(`  </process>`)
  P(``)
  P(`  <bpmndi:BPMNDiagram id="BPMNDiagram_1">`)
  P(`    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="proc_${sid(id)}">`)

  // Pool shape (optional wrapper, helps in some tools)
  P(`      <!-- Pool bounds: ${poolW} x ${poolH} -->`)

  // Lane shapes
  laneNames.forEach((lane, i) => {
    const lx = POOL_X + LANE_HEADER
    const ly = POOL_Y + i * LANE_H
    P(`      <bpmndi:BPMNShape id="${laneId(lane)}_di" bpmnElement="${laneId(lane)}" isHorizontal="true">`)
    P(`        <omgdc:Bounds x="${lx}" y="${ly}" width="${poolW - LANE_HEADER}" height="${LANE_H}"/>`)
    P(`      </bpmndi:BPMNShape>`)
  })

  // Node shapes
  nodes.forEach((n) => {
    const r = pos.get(n.xmlId)!
    P(`      <bpmndi:BPMNShape id="${n.xmlId}_di" bpmnElement="${n.xmlId}">`)
    P(`        <omgdc:Bounds x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`)
    if (n.name && n.type === 'task') {
      P(`        <bpmndi:BPMNLabel/>`)
    }
    P(`      </bpmndi:BPMNShape>`)
  })

  // Edge waypoints
  edges.forEach((e) => {
    const s = pos.get(e.source)!
    const t = pos.get(e.target)!
    const sx = Math.round(s.x + s.w)
    const sy = Math.round(s.y + s.h / 2)
    const tx = Math.round(t.x)
    const ty = Math.round(t.y + t.h / 2)

    P(`      <bpmndi:BPMNEdge id="${e.id}_di" bpmnElement="${e.id}">`)
    if (sy !== ty) {
      // elbow routing when crossing lanes
      const mx = Math.round((sx + tx) / 2)
      P(`        <omgdi:waypoint x="${sx}" y="${sy}"/>`)
      P(`        <omgdi:waypoint x="${mx}" y="${sy}"/>`)
      P(`        <omgdi:waypoint x="${mx}" y="${ty}"/>`)
      P(`        <omgdi:waypoint x="${tx}" y="${ty}"/>`)
    } else {
      P(`        <omgdi:waypoint x="${sx}" y="${sy}"/>`)
      P(`        <omgdi:waypoint x="${tx}" y="${ty}"/>`)
    }
    P(`      </bpmndi:BPMNEdge>`)
  })

  P(`    </bpmndi:BPMNPlane>`)
  P(`  </bpmndi:BPMNDiagram>`)
  P(`</definitions>`)

  return lines.join('\n')
}

export default class GenerateBpmnTool extends Tool<Schema> {
  name = 'generate_bpmn'
  title = 'Generuj BPMN z Markdown'
  description =
    'Konwertuje plik .md z dokumentacją procesu (format VIVE ERP: sekcje ### S{n} – {nazwa} z tabelami atrybutów) na plik BPMN 2.0 XML gotowy do importu w Camunda Modeler lub bpmn.io. Tworzy lanes per Obszar, tasks per krok, gateways AND/XOR, sequence flows i layout DI.'

  async handle({ args, response }: ToolContext<Schema>) {
    const viveRoot = process.env.MCP_WORKSPACE_ROOT || 'C:\\projects\\vive_ERP'
    const sourcePath = join(viveRoot, args?.source_path ?? '')

    if (!args?.source_path) {
      return response.text('BŁĄD: Parametr source_path jest wymagany.')
    }

    let outputPath: string
    if (args?.output_path) {
      outputPath = join(viveRoot, args.output_path)
    } else {
      const base = basename(sourcePath, extname(sourcePath))
      outputPath = join(viveRoot, 'raport', `${base}.bpmn`)
    }

    let content: string
    try {
      content = await readFile(sourcePath, 'utf-8')
    } catch {
      return response.text(`BŁĄD: Nie można odczytać pliku: ${args?.source_path}`)
    }

    const meta = parseMarkdown(content)

    if (meta.steps.length === 0) {
      return response.text(
        `BŁĄD: Nie znaleziono kroków procesu w ${args?.source_path}.\n` +
          `Sprawdź czy plik zawiera sekcje "### S{n} – {nazwa}".`
      )
    }

    const bpmn = generateBpmn(meta)

    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, bpmn, 'utf-8')

    const relOutput = outputPath.replace(viveRoot + '\\', '')
    const lanes = [...new Set(meta.steps.map((s) => s.area).filter(Boolean))]

    return response.text(
      `✅ BPMN wygenerowany pomyślnie!\n\n` +
        `📄 Plik wyjściowy: ${relOutput}\n` +
        `🔢 Kroków procesu: ${meta.steps.length}\n` +
        `🏊 Lanes (Obszary): ${lanes.join(' | ')}\n` +
        `📦 Węzłów BPMN: start + ${meta.steps.length} tasks + end\n\n` +
        `Otwórz w: https://demo.bpmn.io (przeciągnij plik) lub Camunda Modeler.`
    )
  }

  schema() {
    return {
      type: 'object',
      properties: {
        source_path: {
          type: 'string',
          description:
            'Ścieżka do pliku .md, relatywna do C:\\projects\\vive_ERP. Np. procesy/Ochrona-Srodowiska/OS-001-SENT-wysylka-krajowa-as-is.md',
        },
        output_path: {
          type: 'string',
          description:
            'Opcjonalna ścieżka wyjściowa .bpmn, relatywna do C:\\projects\\vive_ERP. Domyślnie: raport/{nazwa-pliku}.bpmn',
        },
      },
      required: ['source_path'],
    } as Schema
  }
}
