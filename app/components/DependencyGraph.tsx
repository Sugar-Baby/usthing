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

const NODE_W = 138
const NODE_H = 46
const GAP_X = 12
const GAP_Y = 58

/**
 * Dependency graph: the course on top, its direct prerequisites on the next
 * level, and their prerequisites below that. Edges are bezier curves drawn
 * with react-native-svg; every node is tappable. Wide levels scroll
 * horizontally rather than shrinking the nodes.
 */
export const DependencyGraph: FC<DependencyGraphProps> = ({
  code,
  term,
  onOpenCourse,
  completed = [],
}) => {
  const { themed, theme } = useAppTheme()
  const completedSet = useMemo(() => new Set(completed), [completed])

  const { level1, level2, edges } = useMemo(() => {
    const direct = [...new Set(flattenDnf(resolveDetail(code, term)?.pqd))]
    const children = new Map<string, string[]>()
    const seen = new Set<string>([code, ...direct])
    const second: string[] = []
    for (const parent of direct) {
      const subs = [...new Set(flattenDnf(resolveDetail(parent, term)?.pqd))].filter(
        (c) => !seen.has(c),
      )
      for (const s of subs) {
        if (!seen.has(s)) {
          seen.add(s)
          second.push(s)
        }
      }
      children.set(parent, subs)
    }
    const edgeList: { from: string; to: string }[] = []
    for (const child of direct) edgeList.push({ from: code, to: child })
    for (const [parent, subs] of children) {
      for (const s of subs) edgeList.push({ from: parent, to: s })
    }
    return { level1: direct, level2: second, edges: edgeList }
  }, [code, term])

  if (level1.length === 0) return null

  const rows = [level1, level2].filter((r) => r.length > 0)
  const allRows = [[code], ...rows]
  const width = Math.max(1, ...allRows.map((r) => r.length)) * (NODE_W + GAP_X) + GAP_X
  const height = allRows.length * NODE_H + (allRows.length - 1) * GAP_Y + 24

  // node code -> centre point
  const positions = new Map<string, { x: number; y: number }>()
  allRows.forEach((row, rowIndex) => {
    const rowWidth = row.length * NODE_W + (row.length - 1) * GAP_X
    const startX = (width - rowWidth) / 2
    row.forEach((nodeCode, i) => {
      positions.set(nodeCode, {
        x: startX + i * (NODE_W + GAP_X) + NODE_W / 2,
        y: 12 + rowIndex * (NODE_H + GAP_Y) + NODE_H / 2,
      })
    })
  })

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height}>
          {edges.map(({ from, to }, i) => {
            const a = positions.get(from)
            const b = positions.get(to)
            if (!a || !b) return null
            const y1 = a.y + NODE_H / 2
            const y2 = b.y - NODE_H / 2
            const midY = (y1 + y2) / 2
            return (
              <Path
                key={`${from}-${to}-${i}`}
                d={`M ${a.x} ${y1} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${y2}`}
                stroke={theme.colors.primaryBorder}
                strokeWidth={2}
                fill="none"
              />
            )
          })}

          {allRows.flat().map((nodeCode) => {
            const pos = positions.get(nodeCode)
            if (!pos) return null
            const isRoot = nodeCode === code
            const isDone = completedSet.has(nodeCode)
            const known = !!resolveCourse(nodeCode, term)
            const fill = isRoot
              ? theme.colors.primary
              : isDone
                ? theme.colors.successLight
                : known
                  ? theme.colors.surface
                  : theme.colors.surfaceVariant
            const stroke = isRoot
              ? theme.colors.primary
              : isDone
                ? theme.colors.success
                : known
                  ? theme.colors.primaryBorder
                  : theme.colors.border
            const color = isRoot
              ? "#FFFFFF"
              : isDone
                ? theme.colors.success
                : known
                  ? theme.colors.primary
                  : theme.colors.textMuted
            const title = known ? (resolveCourse(nodeCode, term)?.t ?? "") : "not in catalog"
            return (
              <G key={nodeCode}>
                <Rect
                  x={pos.x - NODE_W / 2}
                  y={pos.y - NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isRoot || isDone ? 2 : 1}
                  onPress={isRoot ? undefined : () => onOpenCourse(nodeCode)}
                />
                <SvgText
                  x={pos.x}
                  y={pos.y - 4}
                  fontSize={13}
                  fontWeight="700"
                  fill={color}
                  textAnchor="middle"
                  onPress={isRoot ? undefined : () => onOpenCourse(nodeCode)}
                >
                  {nodeCode}
                </SvgText>
                <SvgText
                  x={pos.x}
                  y={pos.y + 12}
                  fontSize={9}
                  fill={isRoot ? "rgba(255,255,255,0.85)" : theme.colors.textMuted}
                  textAnchor="middle"
                >
                  {title.length > 20 ? `${title.slice(0, 19)}…` : title}
                </SvgText>
              </G>
            )
          })}
        </Svg>
      </ScrollView>
      <Text
        text={
          level2.length > 0
            ? "Deeper prerequisites shown one more level down. Tap any node to open the course."
            : "Tap any node to open the course."
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
