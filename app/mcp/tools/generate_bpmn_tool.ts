import type { ToolContext } from '@jrmc/adonis-mcp/types/context'
import type { BaseSchema } from '@jrmc/adonis-mcp/types/method'
import { Tool } from '@jrmc/adonis-mcp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, basename, extname } from 'node:path'
import { readWorkspaceConfig } from './set_workspace_tool.js'

type Schema = BaseSchema<{
  source_path: { type: 'string' }
  output_path: { type: 'string' }
  workspace_root: { type: 'string' }
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

// ─── Routing types ────────────────────────────────────────────────────────────

type RoutingType = 'linear' | 'and-split' | 'xor-split' | 'and-merge' | 'xor-merge' | 'loop' | 'end' | 'default'

interface RouteTarget { id: string; label?: string }

interface Routing {
  type: RoutingType
  targets: RouteTarget[]
}

function parseNextField(next: string): Routing {
  const n = (next || '').trim()
  if (!n) return { type: 'default', targets: [] }

  if (n === '(koniec)') return { type: 'end', targets: [] }
  if (n === '(scal AND)') return { type: 'and-merge', targets: [] }
  if (n === '(scal XOR)') return { type: 'xor-merge', targets: [] }

  // AND → [S4, S7]
  const andM = n.match(/AND\s*[→>]\s*\[([^\]]+)\]/i)
  if (andM) {
    const targets = andM[1].split(',').map((s) => ({ id: s.trim().match(/S\d+/i)?.[0] ?? s.trim() }))
    return { type: 'and-split', targets }
  }

  // XOR → [Tak: S5, Nie: S7]  or  XOR → [S5, S7]
  const xorM = n.match(/XOR\s*[→>]\s*\[([^\]]+)\]/i)
  if (xorM) {
    const targets = xorM[1].split(',').map((s) => {
      const t = s.trim()
      const ci = t.indexOf(':')
      if (ci > 0) return { label: t.slice(0, ci).trim(), id: t.slice(ci + 1).trim().match(/S\d+/i)?.[0] ?? t.slice(ci + 1).trim() }
      return { id: t.match(/S\d+/i)?.[0] ?? t }
    })
    return { type: 'xor-split', targets }
  }

  // pętla → S2
  const loopM = n.match(/p[eę]tla\s*[→>]\s*(S\d+)/i)
  if (loopM) return { type: 'loop', targets: [{ id: loopM[1] }] }

  // Simple S3
  const stepM = n.match(/^(S\d+)/i)
  if (stepM) return { type: 'linear', targets: [{ id: stepM[1] }] }

  return { type: 'default', targets: [] }
}

// ─── Markdown parser ──────────────────────────────────────────────────────────

function getTableAttr(body: string, attr: string): string {
  // Escape regex special chars in attr (e.g. ⚙️)
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\|[^|]*${escaped}[^|]*\\|\\s*(.+?)\\s*\\|`)
  const m = body.match(re)
  // Strip markdown bold, icons, backticks
  return m ? m[1].replace(/\*\*/g, '').replace(/⚙️/g, '').replace(/`/g, '').trim() : ''
}

function parseMarkdown(content: string): ProcessMeta {
  const titleMatch = content.match(/^# (.+)/m)
  const title = titleMatch ? titleMatch[1].trim() : 'Process'
  const idMatch = title.match(/^([A-Z]+-\d+)/i)
  const processId = idMatch ? idMatch[1].replace('-', '_') : 'proc_001'

  const typeMatch = content.match(/\*\*Typ:\*\*\s*(.+)/)
  const dateMatch = content.match(/\*\*Data udokumentowania:\*\*\s*(.+)/)

  const steps: ProcessStep[] = []
  const stepRegex = /### (S\d+)([^\n]*)\n([\s\S]+?)(?=\n### S\d+|\n---|\n## |$)/gi
  let m: RegExpExecArray | null

  while ((m = stepRegex.exec(content)) !== null) {
    const body = m[3]
    const rawHeader = m[2].trim()
    const name = rawHeader.includes('–') ? rawHeader.split('–').slice(1).join('–').trim() : rawHeader
    steps.push({
      id: m[1].toUpperCase(),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Layout types ─────────────────────────────────────────────────────────────

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
  isLoop?: boolean
}

// ─── BPMN generator ──────────────────────────────────────────────────────────

function generateBpmn(meta: ProcessMeta): string {
  const { id, title, steps } = meta

  // ── 1. Lane names (order preserved) ─────────────────────────────────────
  const laneNames: string[] = []
  steps.forEach((s) => {
    const a = s.area || 'Proces'
    if (!laneNames.includes(a)) laneNames.push(a)
  })
  if (!laneNames.length) laneNames.push('Proces')

  const laneId = (name: string) => `lane_${sid(name)}`
  const firstArea = steps[0]?.area || laneNames[0]
  const lastArea = steps[steps.length - 1]?.area || laneNames[laneNames.length - 1]

  // ── 2. Parse routing for all steps ──────────────────────────────────────
  const routingMap = new Map<string, Routing>()
  steps.forEach((s) => routingMap.set(s.id, parseNextField(s.next)))

  // ── 3. Identify AND / XOR merge groups ───────────────────────────────────
  // Consecutive (scal AND/XOR) steps → next non-scal step is the merge target
  type MergeGroup = { type: 'and-merge' | 'xor-merge'; scalSteps: string[]; mergeTarget: string }
  const mergeGroups: MergeGroup[] = []
  let currentScalAnd: string[] = []
  let currentScalXor: string[] = []

  const flushScal = (nextStepId: string) => {
    if (currentScalAnd.length) {
      mergeGroups.push({ type: 'and-merge', scalSteps: [...currentScalAnd], mergeTarget: nextStepId })
      currentScalAnd = []
    }
    if (currentScalXor.length) {
      mergeGroups.push({ type: 'xor-merge', scalSteps: [...currentScalXor], mergeTarget: nextStepId })
      currentScalXor = []
    }
  }

  steps.forEach((step, idx) => {
    const r = routingMap.get(step.id)!
    if (r.type === 'and-merge') {
      currentScalAnd.push(step.id)
    } else if (r.type === 'xor-merge') {
      currentScalXor.push(step.id)
    } else {
      flushScal(step.id)
    }
  })
  // trailing scal steps → connect to end
  if (currentScalAnd.length || currentScalXor.length) flushScal('__end__')

  // Lookup: mergeTarget → merge group
  const mergeForTarget = new Map<string, MergeGroup>()
  mergeGroups.forEach((g) => mergeForTarget.set(g.mergeTarget, g))

  // Helper: resolve the actual xmlId to target (accounting for merge gateway before it)
  const taskXmlId = (stepId: string) => `task_${sid(stepId)}`
  const resolveTarget = (stepId: string): string => {
    if (stepId === '__end__') return 'ee_end'
    const mg = mergeForTarget.get(stepId)
    if (mg) return mg.type === 'and-merge' ? `gw_and_merge_${sid(stepId)}` : `gw_xor_merge_${sid(stepId)}`
    return taskXmlId(stepId)
  }

  // ── 4. Build node list ────────────────────────────────────────────────────
  const nodes: LayoutNode[] = []
  let col = 0

  nodes.push({ xmlId: 'se_start', type: 'startEvent', name: steps[0]?.trigger || 'Start', lane: firstArea, col: col++ })

  steps.forEach((step) => {
    // Insert merge gateway BEFORE this step if it's a merge target
    const mg = mergeForTarget.get(step.id)
    if (mg) {
      const gwType = mg.type === 'and-merge' ? 'parallelGateway' : 'exclusiveGateway'
      const gwId = mg.type === 'and-merge' ? `gw_and_merge_${sid(step.id)}` : `gw_xor_merge_${sid(step.id)}`
      nodes.push({ xmlId: gwId, type: gwType, name: '', lane: step.area || laneNames[0], col: col++ })
    }

    // The task itself
    nodes.push({
      xmlId: taskXmlId(step.id),
      type: 'task',
      name: `${step.id} – ${step.name}`,
      lane: step.area || laneNames[0],
      col: col++,
    })

    // Insert split gateway AFTER this step
    const r = routingMap.get(step.id)!
    if (r.type === 'and-split') {
      nodes.push({ xmlId: `gw_and_${sid(step.id)}`, type: 'parallelGateway', name: '', lane: step.area || laneNames[0], col: col++ })
    } else if (r.type === 'xor-split') {
      nodes.push({ xmlId: `gw_xor_${sid(step.id)}`, type: 'exclusiveGateway', name: '', lane: step.area || laneNames[0], col: col++ })
    }
  })

  nodes.push({ xmlId: 'ee_end', type: 'endEvent', name: 'Koniec procesu', lane: lastArea, col: col })

  // ── 5. Build edge list ────────────────────────────────────────────────────
  const edges: LayoutEdge[] = []
  let ei = 0
  const E = (source: string, target: string, name?: string, isLoop?: boolean) =>
    edges.push({ id: `sf_${++ei}`, source, target, name, isLoop })

  // Start → first target (or merge gateway before it)
  E('se_start', resolveTarget(steps[0]?.id ?? '__end__'))

  steps.forEach((step, idx) => {
    const r = routingMap.get(step.id)!
    const src = taskXmlId(step.id)

    switch (r.type) {
      case 'end':
        E(src, 'ee_end')
        break

      case 'and-split': {
        const gw = `gw_and_${sid(step.id)}`
        E(src, gw)
        r.targets.forEach((t) => E(gw, resolveTarget(t.id)))
        break
      }

      case 'xor-split': {
        const gw = `gw_xor_${sid(step.id)}`
        E(src, gw)
        r.targets.forEach((t) => E(gw, resolveTarget(t.id), t.label))
        break
      }

      case 'and-merge':
      case 'xor-merge': {
        // scal step → merge gateway
        const group = mergeGroups.find((g) => g.scalSteps.includes(step.id))
        if (group) {
          const gwId =
            group.type === 'and-merge'
              ? `gw_and_merge_${sid(group.mergeTarget)}`
              : `gw_xor_merge_${sid(group.mergeTarget)}`
          E(src, gwId)
          // Merge gateway → merge target (add once, when last scal step of group is processed)
          if (group.scalSteps[group.scalSteps.length - 1] === step.id) {
            E(gwId, resolveTarget(group.mergeTarget === '__end__' ? '__end__' : group.mergeTarget))
          }
        }
        break
      }

      case 'loop':
        if (r.targets.length) E(src, resolveTarget(r.targets[0].id), 'powrót', true)
        break

      case 'linear':
        if (r.targets.length) E(src, resolveTarget(r.targets[0].id))
        break

      default: {
        // Default: connect to next non-scal step in array, or end event
        let nextTarget = 'ee_end'
        for (let j = idx + 1; j < steps.length; j++) {
          const nr = routingMap.get(steps[j].id)!
          if (nr.type !== 'and-merge' && nr.type !== 'xor-merge') {
            nextTarget = steps[j].id
            break
          }
        }
        E(src, resolveTarget(nextTarget))
        break
      }
    }
  })

  // ── 6. Layout constants ───────────────────────────────────────────────────
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

  // ── 7. XML output ─────────────────────────────────────────────────────────
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
  P(`             targetNamespace="http://example.com/bpmn/${sid(id)}">`)
  P(``)
  P(`  <process id="proc_${sid(id)}" name="${x(title)}" isExecutable="false">`)
  P(``)
  P(`    <laneSet id="ls_${sid(id)}">`)

  laneNames.forEach((lane) => {
    P(`      <lane id="${laneId(lane)}" name="${x(lane)}">`)
    nodes
      .filter((n) => n.lane === lane)
      .forEach((n) => P(`        <flowNodeRef>${n.xmlId}</flowNodeRef>`))
    P(`      </lane>`)
  })

  P(`    </laneSet>`)
  P(``)

  // BPMN elements
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
      const step = steps.find((s) => n.xmlId === taskXmlId(s.id))
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
    const r = pos.get(n.xmlId)
    if (!r) return
    P(`      <bpmndi:BPMNShape id="${n.xmlId}_di" bpmnElement="${n.xmlId}">`)
    P(`        <omgdc:Bounds x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`)
    if (n.name && n.type === 'task') P(`        <bpmndi:BPMNLabel/>`)
    P(`      </bpmndi:BPMNShape>`)
  })

  // Edge waypoints
  edges.forEach((e) => {
    const s = pos.get(e.source)
    const t = pos.get(e.target)
    if (!s || !t) return

    const sx = Math.round(s.x + s.w)
    const sy = Math.round(s.y + s.h / 2)
    const tx = Math.round(t.x)
    const ty = Math.round(t.y + t.h / 2)

    P(`      <bpmndi:BPMNEdge id="${e.id}_di" bpmnElement="${e.id}">`)

    if (e.isLoop) {
      // Loop: arc below the tasks
      const loopY = Math.max(sy, ty) + 60
      P(`        <omgdi:waypoint x="${sx}" y="${sy}"/>`)
      P(`        <omgdi:waypoint x="${sx}" y="${loopY}"/>`)
      P(`        <omgdi:waypoint x="${tx}" y="${loopY}"/>`)
      P(`        <omgdi:waypoint x="${tx}" y="${ty}"/>`)
    } else if (sy !== ty) {
      // Elbow routing when crossing lanes
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

// ─── Tool class ───────────────────────────────────────────────────────────────

export default class GenerateBpmnTool extends Tool<Schema> {
  name = 'generate_bpmn'
  title = 'Generuj BPMN z Markdown'
  description =
    'Konwertuje plik .md z dokumentacją procesu (format szablon-procesu.md) na plik BPMN 2.0 XML gotowy do importu w Camunda Modeler lub bpmn.io. Działa z dowolnym projektem – podaj workspace_root jako ścieżkę absolutną do katalogu projektu. Obsługuje: przepływ liniowy, AND split+merge, XOR decyzje, pętle, zdarzenia końcowe.'

  async handle({ args, response }: ToolContext<Schema>) {
    // Priority: 1) args.workspace_root  2) mcp-workspace.json  3) MCP_WORKSPACE_ROOT (.env)
    const workspaceRoot =
      args?.workspace_root ||
      (await readWorkspaceConfig()) ||
      process.env.MCP_WORKSPACE_ROOT ||
      ''

    if (!workspaceRoot) {
      return response.text(
        'BŁĄD: Nie ustawiono workspace.\n\n' +
          'Opcja 1 (zalecana): wywołaj set_workspace(workspace_root: "C:/projects/twoj-projekt")\n' +
          'Opcja 2: podaj workspace_root bezpośrednio w tym wywołaniu\n' +
          'Opcja 3: ustaw MCP_WORKSPACE_ROOT w .env serwera i zrestartuj'
      )
    }

    const sourcePath = join(workspaceRoot, args?.source_path ?? '')

    if (!args?.source_path) {
      return response.text('BŁĄD: Parametr source_path jest wymagany.')
    }

    let outputPath: string
    if (args?.output_path) {
      outputPath = join(workspaceRoot, args.output_path)
    } else {
      const base = basename(sourcePath, extname(sourcePath))
      outputPath = join(workspaceRoot, 'raport', `${base}.bpmn`)
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
          `Sprawdź czy plik zawiera sekcje "### S{n} – {nazwa}" z atrybutem "Obszar".`
      )
    }

    const bpmn = generateBpmn(meta)

    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, bpmn, 'utf-8')

    const relOutput = outputPath.replace(workspaceRoot + '\\', '').replace(workspaceRoot + '/', '')
    const lanes = [...new Set(meta.steps.map((s) => s.area).filter(Boolean))]

    // Count gateways
    const routings = meta.steps.map((s) => parseNextField(s.next))
    const andSplits = routings.filter((r) => r.type === 'and-split').length
    const xorSplits = routings.filter((r) => r.type === 'xor-split').length
    const loops = routings.filter((r) => r.type === 'loop').length

    return response.text(
      `✅ BPMN wygenerowany pomyślnie!\n\n` +
        `📄 Plik wyjściowy: ${relOutput}\n` +
        `🔢 Kroków procesu: ${meta.steps.length}\n` +
        `🏊 Lanes (Obszary): ${lanes.join(' | ')}\n` +
        `🔀 Bramki AND: ${andSplits} | XOR: ${xorSplits} | Pętle: ${loops}\n\n` +
        `Otwórz w: https://demo.bpmn.io (przeciągnij plik) lub Camunda Modeler.`
    )
  }

  schema() {
    return {
      type: 'object',
      properties: {
        workspace_root: {
          type: 'string',
          description:
            'Absolutna ścieżka do katalogu projektu, np. "C:\\\\projects\\\\moj-projekt" lub "/home/user/projekty/erp". ' +
            'Jeśli pominięte, używana jest zmienna MCP_WORKSPACE_ROOT z .env serwera.',
        },
        source_path: {
          type: 'string',
          description:
            'Ścieżka do pliku .md relatywna do workspace_root. Np. procesy/P2P/P2P-001-zakup-surowca-as-is.md',
        },
        output_path: {
          type: 'string',
          description:
            'Opcjonalna ścieżka wyjściowa .bpmn relatywna do workspace_root. Domyślnie: raport/{nazwa-pliku}.bpmn',
        },
      },
      required: ['source_path'],
    } as Schema
  }
}
