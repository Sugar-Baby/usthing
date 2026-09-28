import { FC, useMemo } from "react"
import { ScrollView, View, ViewStyle } from "react-native"
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg"

import { Text } from "@/components/Text"
import { resolveCourse, resolveDetail } from "@/services/courses"
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
const NODE_H = 44
const PAD = 12
const LABEL_H = 20
const INNER_GAP = 34
const GROUP_GAP = 40
const ROOT_GAP = 74
const MARGIN = 12

/**
 * Dependency graph for one course, with the boolean structure drawn rather
 * than implied:
 *
 *   - each OR alternative is a dashed "option" box ("OPTION n · ALL OF"),
 *     separated by an `or` label,
 *   - courses inside a box are joined by `and` labels — all of them are
 *     required to satisfy that option,
 *   - a course with a single option gets no box; a course with a single
 *     prerequisite is just one node.
 *
 * Every node is tappable. Nodes are wider than tall so long titles stay
 * readable; wide graphs scroll horizontally.
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
  if (!hasAny) return null

  const multiple = groups.length > 1
  const groupWidth = NODE_W + PAD * 2
  const groupHeights = groups.map(
    (codes) => LABEL_H + codes.length * NODE_H + (codes.length - 1) * INNER_GAP + PAD * 2,
  )
  const maxGroupHeight = Math.max(...groupHeights)
  const contentWidth = multiple
    ? groups.length * groupWidth + (groups.length - 1) * GROUP_GAP
    : NODE_W
  const width = Math.max(NODE_W, contentWidth) + MARGIN * 2
  const height = NODE_H + ROOT_GAP + maxGroupHeight + MARGIN * 2 + (multiple ? 18 : 0)

  const rootCx = width / 2
  const rootCy = MARGIN + NODE_H / 2
  const groupsTop = MARGIN + NODE_H + ROOT_GAP
  const startX = (width - contentWidth) / 2

  const boxes = groups.map((codes, gi) => {
    const x = startX + gi * (groupWidth + GROUP_GAP)
    const h = groupHeights[gi]
    const y = groupsTop + (maxGroupHeight - h) / 2
    const nodes = codes.map((c, ci) => ({
      code: c,
      cx: x + PAD + NODE_W / 2,
      cy: y + PAD + LABEL_H + ci * (NODE_H + INNER_GAP) + NODE_H / 2,
    }))
    return { gi, x, y, w: groupWidth, h, nodes }
  })

  const renderNode = (nodeCode: string, cx: number, cy: number, key: string) => {
    const isDone = completedSet.has(nodeCode)
    const known = !!resolveCourse(nodeCode, term)
    const title = known ? (resolveCourse(nodeCode, term)?.t ?? "") : "not in catalog"
    return (
      <G key={key}>
        <Rect
          x={cx - NODE_W / 2}
          y={cy - NODE_H / 2}
          width={NODE_W}
          height={NODE_H}
          rx={8}
          fill={isDone ? theme.colors.successLight : known ? theme.colors.surface : theme.colors.surfaceVariant}
          stroke={isDone ? theme.colors.success : known ? theme.colors.primaryBorder : theme.colors.border}
          strokeWidth={isDone ? 2 : 1}
          onPress={() => onOpenCourse(nodeCode)}
        />
        <SvgText
          x={cx}
          y={cy - 3}
          fontSize={13}
          fontWeight="700"
          fill={isDone ? theme.colors.success : known ? theme.colors.primary : theme.colors.textMuted}
          textAnchor="middle"
          onPress={() => onOpenCourse(nodeCode)}
        >
          {nodeCode}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 13}
          fontSize={9}
          fill={theme.colors.textMuted}
          textAnchor="middle"
        >
          {title.length > 20 ? `${title.slice(0, 19)}…` : title}
        </SvgText>
      </G>
    )
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height}>
          {/* edges: the course points at every option box */}
          {boxes.map((box) => (
            <Path
              key={`edge-${box.gi}`}
              d={`M ${rootCx} ${rootCy + NODE_H / 2} C ${rootCx} ${groupsTop - 20}, ${
                box.x + box.w / 2
              } ${groupsTop - 20}, ${box.x + box.w / 2} ${box.y}`}
              stroke={theme.colors.primaryBorder}
              strokeWidth={2}
              fill="none"
            />
          ))}

          {/* the course itself */}
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
              y={rootCy - 3}
              fontSize={13}
              fontWeight="700"
              fill="#FFFFFF"
              textAnchor="middle"
            >
              {code}
            </SvgText>
            <SvgText
              x={rootCx}
              y={rootCy + 13}
              fontSize={9}
              fill="rgba(255,255,255,0.85)"
              textAnchor="middle"
            >
              {(resolveCourse(code, term)?.t ?? "").slice(0, 20)}
            </SvgText>
          </G>

          {/* option boxes (only when there is a choice to make) */}
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
                  y={box.y + PAD + 10}
                  fontSize={10}
                  fontWeight="700"
                  fill={theme.colors.secondaryDark}
                  textAnchor="middle"
                >
                  {`OPTION ${box.gi + 1} · ALL OF`}
                </SvgText>
              </G>
            ))}

          {/* 'or' between option boxes */}
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

          {/* 'and' between prerequisites inside one option */}
          {boxes.map((box) =>
            box.nodes.slice(1).map((node, i) => (
              <SvgText
                key={`and-${box.gi}-${i}`}
                x={node.cx - NODE_W / 2 + 12}
                y={node.cy - NODE_H / 2 - INNER_GAP / 2 + 4}
                fontSize={10}
                fontStyle="italic"
                fill={theme.colors.textMuted}
              >
                and
              </SvgText>
            )),
          )}

          {boxes.map((box) => box.nodes.map((n, ci) => renderNode(n.code, n.cx, n.cy, `${box.gi}-${ci}`)))}
        </Svg>
      </ScrollView>
      <Text
        text={
          multiple
            ? "Complete any one option — courses joined by “and” inside an option must all be taken."
            : "All of these are required. Tap any node to open the course."
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
