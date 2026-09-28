import { FC, useMemo } from "react"
import { ScrollView, View, ViewStyle } from "react-native"
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg"

import { Text } from "@/components/Text"
import { flattenDnf, resolveCourse, resolveDetail } from "@/services/courses"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface DependencyGraphProps {
  code: string
  term: string
  onOpenCourse: (code: string) => void
  /** codes the user has marked as taken — drawn in green */
  completed?: string[]
}

const NODE_W = 168
const NODE_H = 58
const SUB_W = 150
const SUB_H = 30
const PAD = 12
const LABEL_H = 20
const ITEM_GAP = 6
const GROUP_GAP = 40
const ROOT_GAP = 74
const MARGIN = 12
const MAX_SUB = 2

/** Wrap a course title into at most two lines of `maxChars`. */
function wrapTitle(title: string, maxChars = 22, maxLines = 2): string[] {
  const lines: string[] = []
  let rest = title.trim()
  while (rest.length > 0 && lines.length < maxLines) {
    if (rest.length <= maxChars) {
      lines.push(rest)
      rest = ""
      break
    }
    let cut = rest.lastIndexOf(" ", maxChars)
    if (cut <= 0) cut = maxChars
    lines.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest.length > 0 && lines.length === maxLines) {
    const lastLine = lines[maxLines - 1]
    lines[maxLines - 1] = `${lastLine.length > maxChars - 1 ? lastLine.slice(0, maxChars - 1) : lastLine}…`
  }
  return lines
}

type FlowItem =
  | { kind: "and"; height: number }
  | { kind: "main"; code: string; height: number }
  | { kind: "sub"; code: string; parent: string; height: number }
  | { kind: "more"; count: number; parent: string; height: number }

/**
 * Dependency graph for one course, out to two levels.
 *
 *   - Each OR alternative is a dashed "OPTION n" box separated by an `or`
 *     label; courses inside a box are joined by `and` labels.
 *   - Under every prerequisite, its own prerequisites appear as small
 *     nodes (at most two; "+n" beyond that) so a chain is visible without
 *     leaving the page.
 *   - A single option is drawn without a box, the course pointing straight
 *     at what it needs.
 *
 * Every node is tappable; taken courses are green; wide graphs scroll
 * horizontally.
 */
export const DependencyGraph: FC<DependencyGraphProps> = ({
  code,
  term,
  onOpenCourse,
  completed = [],
}) => {
  const { themed, theme } = useAppTheme()
  const completedSet = useMemo(() => new Set(completed), [completed])

  const groups = useMemo(() => {
    const dnf = resolveDetail(code, term)?.pqd ?? []
    return dnf.map((group) => {
      const codes = Array.isArray(group) ? group : [group]
      return [...new Set(codes)].filter((c) => c !== code)
    })
  }, [code, term])

  const hasAny = groups.some((g) => g.length > 0)

  const layout = useMemo(() => {
    if (!hasAny) return null
    const multiple = groups.length > 1
    const groupWidth = multiple ? NODE_W + PAD * 2 : NODE_W

    const flows: FlowItem[][] = groups.map((codes) => {
      const flow: FlowItem[] = []
      const inOption = new Set(codes)
      codes.forEach((c, ci) => {
        if (ci > 0) flow.push({ kind: "and", height: 18 })
        flow.push({ kind: "main", code: c, height: NODE_H })
        const subs = [...new Set(flattenDnf(resolveDetail(c, term)?.pqd))].filter(
          (s) => s !== c && !inOption.has(s),
        )
        for (const s of subs.slice(0, MAX_SUB)) {
          flow.push({ kind: "sub", code: s, parent: c, height: SUB_H })
        }
        if (subs.length > MAX_SUB) {
          flow.push({ kind: "more", count: subs.length - MAX_SUB, parent: c, height: 16 })
        }
      })
      return flow
    })

    const flowHeight = (flow: FlowItem[]) =>
      flow.reduce((sum, item) => sum + item.height + ITEM_GAP, 0) - ITEM_GAP
    const groupHeights = flows.map((flow) => flowHeight(flow) + (multiple ? PAD * 2 + LABEL_H : 0))
    const maxGroupHeight = Math.max(...groupHeights)
    const contentWidth = multiple
      ? groups.length * groupWidth + (groups.length - 1) * GROUP_GAP
      : NODE_W
    const width = Math.max(NODE_W, contentWidth) + MARGIN * 2
    const height = NODE_H + ROOT_GAP + maxGroupHeight + MARGIN * 2

    const rootCx = width / 2
    const rootCy = MARGIN + NODE_H / 2
    const groupsTop = MARGIN + NODE_H + ROOT_GAP
    const startX = (width - contentWidth) / 2

    const boxes = flows.map((flow, gi) => {
      const x = startX + gi * (groupWidth + GROUP_GAP)
      const boxHeight = groupHeights[gi]
      const y = groupsTop + (maxGroupHeight - boxHeight) / 2
      let cursor = y + (multiple ? PAD + LABEL_H : 0)
      const placed = flow.map((item) => {
        const itemY = cursor
        cursor += item.height + ITEM_GAP
        return {
          item,
          cx: multiple ? x + PAD + NODE_W / 2 : rootCx,
          top: itemY,
        }
      })
      return { gi, x, y, w: groupWidth, h: boxHeight, placed }
    })

    const mainPositions = new Map<string, { cx: number; top: number }>()
    for (const box of boxes) {
      for (const p of box.placed) {
        if (p.item.kind === "main") mainPositions.set(p.item.code, { cx: p.cx, top: p.top })
      }
    }

    const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
    if (multiple) {
      for (const box of boxes) {
        edges.push({ x1: rootCx, y1: rootCy + NODE_H / 2, x2: box.x + box.w / 2, y2: box.y })
      }
    } else {
      for (const p of boxes[0]?.placed ?? []) {
        if (p.item.kind === "main") {
          edges.push({ x1: rootCx, y1: rootCy + NODE_H / 2, x2: p.cx, y2: p.top })
        }
      }
    }
    for (const box of boxes) {
      for (const p of box.placed) {
        if (p.item.kind === "sub") {
          const parent = mainPositions.get(p.item.parent)
          if (parent) {
            edges.push({
              x1: parent.cx,
              y1: parent.top + NODE_H,
              x2: p.cx,
              y2: p.top,
            })
          }
        }
      }
    }

    return { multiple, width, height, rootCx, rootCy, groupsTop, maxGroupHeight, boxes, edges }
  }, [groups, hasAny, term])

  if (!layout) return null
  const { multiple, width, height, rootCx, rootCy, groupsTop, maxGroupHeight, boxes, edges } = layout

  const renderMainNode = (nodeCode: string, cx: number, top: number, key: string) => {
    const isDone = completedSet.has(nodeCode)
    const known = !!resolveCourse(nodeCode, term)
    const title = known ? (resolveCourse(nodeCode, term)?.t ?? "") : "not in catalog"
    return (
      <G key={key}>
        <Rect
          x={cx - NODE_W / 2}
          y={top}
          width={NODE_W}
          height={NODE_H}
          rx={8}
          fill={
            isDone ? theme.colors.successLight : known ? theme.colors.surface : theme.colors.surfaceVariant
          }
          stroke={isDone ? theme.colors.success : known ? theme.colors.primaryBorder : theme.colors.border}
          strokeWidth={isDone ? 2 : 1}
          onPress={() => onOpenCourse(nodeCode)}
        />
        <SvgText
          x={cx}
          y={top + 21}
          fontSize={13}
          fontWeight="700"
          fill={isDone ? theme.colors.success : known ? theme.colors.primary : theme.colors.textMuted}
          textAnchor="middle"
          onPress={() => onOpenCourse(nodeCode)}
        >
          {nodeCode}
        </SvgText>
        {wrapTitle(title).map((line, li) => (
          <SvgText
            key={li}
            x={cx}
            y={top + 38 + li * 12}
            fontSize={9.5}
            fill={theme.colors.textMuted}
            textAnchor="middle"
          >
            {line}
          </SvgText>
        ))}
      </G>
    )
  }

  const renderSubNode = (nodeCode: string, cx: number, top: number, key: string) => {
    const isDone = completedSet.has(nodeCode)
    const known = !!resolveCourse(nodeCode, term)
    return (
      <G key={key}>
        <Rect
          x={cx - SUB_W / 2}
          y={top}
          width={SUB_W}
          height={SUB_H}
          rx={6}
          fill={isDone ? theme.colors.successLight : theme.colors.surfaceVariant}
          stroke={isDone ? theme.colors.success : theme.colors.border}
          strokeWidth={1}
          strokeDasharray={isDone ? undefined : "3 3"}
          onPress={() => onOpenCourse(nodeCode)}
        />
        <SvgText
          x={cx}
          y={top + 19}
          fontSize={11}
          fontWeight={isDone ? "700" : "500"}
          fill={isDone ? theme.colors.success : known ? theme.colors.textSecondary : theme.colors.textMuted}
          textAnchor="middle"
          onPress={() => onOpenCourse(nodeCode)}
        >
          {known ? nodeCode : `${nodeCode} (?)`}
        </SvgText>
      </G>
    )
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height}>
          {edges.map((e, i) => {
            const midY = (e.y1 + e.y2) / 2
            return (
              <Path
                key={`edge-${i}`}
                d={`M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`}
                stroke={theme.colors.primaryBorder}
                strokeWidth={2}
                fill="none"
              />
            )
          })}

          <G>
            <Rect
              x={rootCx - NODE_W / 2}
              y={rootCy - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={8}
              fill={theme.colors.primary}
              stroke={theme.colors.primary}
              strokeWidth={2}
            />
            <SvgText
              x={rootCx}
              y={rootCy - NODE_H / 2 + 21}
              fontSize={13}
              fontWeight="700"
              fill="#FFFFFF"
              textAnchor="middle"
            >
              {code}
            </SvgText>
            {wrapTitle(resolveCourse(code, term)?.t ?? "").map((line, li) => (
              <SvgText
                key={li}
                x={rootCx}
                y={rootCy - NODE_H / 2 + 38 + li * 12}
                fontSize={9.5}
                fill="rgba(255,255,255,0.88)"
                textAnchor="middle"
              >
                {line}
              </SvgText>
            ))}
          </G>

          {multiple &&
            boxes.map((box) => (
              <G key={`box-${box.gi}`}>
                <Rect
                  x={box.x}
                  y={box.y}
                  width={box.w}
                  height={box.h}
                  rx={10}
                  fill={theme.colors.transparent}
                  stroke={theme.colors.secondaryBorder}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
                <SvgText
                  x={box.x + box.w / 2}
                  y={box.y + PAD + 11}
                  fontSize={10}
                  fontWeight="700"
                  fill={theme.colors.secondaryDark}
                  textAnchor="middle"
                >
                  {`OPTION ${box.gi + 1}`}
                </SvgText>
              </G>
            ))}

          {multiple &&
            boxes.slice(1).map((box, i) => (
              <SvgText
                key={`or-${i}`}
                x={box.x - GROUP_GAP / 2}
                y={groupsTop + maxGroupHeight / 2}
                fontSize={12}
                fontWeight="700"
                fill={theme.colors.secondaryDark}
                textAnchor="middle"
              >
                or
              </SvgText>
            ))}

          {boxes.flatMap((box, bi) =>
            box.placed.map((p, pi) => {
              const cx = p.cx
              if (p.item.kind === "and") {
                return (
                  <SvgText
                    key={`and-${bi}-${pi}`}
                    x={cx - NODE_W / 2 + 14}
                    y={p.top + 13}
                    fontSize={10}
                    fontStyle="italic"
                    fill={theme.colors.textMuted}
                  >
                    and
                  </SvgText>
                )
              }
              if (p.item.kind === "more") {
                return (
                  <SvgText
                    key={`more-${bi}-${pi}`}
                    x={cx}
                    y={p.top + 12}
                    fontSize={9.5}
                    fontStyle="italic"
                    fill={theme.colors.textMuted}
                    textAnchor="middle"
                  >
                    {`+${p.item.count} more prerequisite${p.item.count === 1 ? "" : "s"}`}
                  </SvgText>
                )
              }
              return null
            }),
          )}

          {boxes.flatMap((box, bi) =>
            box.placed.map((p, pi) => {
              if (p.item.kind === "main") {
                return renderMainNode(p.item.code, p.cx, p.top, `main-${bi}-${pi}`)
              }
              if (p.item.kind === "sub") {
                return renderSubNode(p.item.code, p.cx, p.top, `sub-${bi}-${pi}`)
              }
              return null
            }),
          )}
        </Svg>
      </ScrollView>
      <Text
        text={
          multiple
            ? "Complete any one option — courses joined by “and” must all be taken. Dashed nodes are what the course above them needs."
            : "All of these are required; dashed nodes are what the course above them needs. Tap any node to open it."
        }
        size="xxs"
        style={themed($hint)}
      />
    </View>
  )
}

const $hint: ThemedStyle<{ color: string; marginTop: number }> = (theme) => ({
  color: theme.colors.textMuted,
  marginTop: 8,
})
