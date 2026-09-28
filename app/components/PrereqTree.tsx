import { FC, useState } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"

import { Text } from "@/components/Text"
import type { PrereqDnf } from "@/services/courses"
import { resolveCourse, resolveDetail } from "@/services/courses"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface PrereqTreeProps {
  dnf?: PrereqDnf
  term: string
  onOpenCourse: (code: string) => void
  /** ancestor codes on the current branch — prevents infinite recursion */
  path?: string[]
  depth?: number
}

/**
 * Recursive prerequisite tree.
 *
 * A prerequisite DNF is rendered as OR-groups ("either ... or ..."); inside
 * a group every course is required (AND, joined with "+"). Every course is
 * tappable — the label opens the course detail, the chevron expands that
 * course's own prerequisites in place. `path` carries the ancestors of the
 * current branch so cycles and repeated courses terminate.
 */
export const PrereqTree: FC<PrereqTreeProps> = ({
  dnf,
  term,
  onOpenCourse,
  path = [],
  depth = 0,
}) => {
  const { themed } = useAppTheme()
  if (!dnf || dnf.length === 0) return null

  return (
    <View style={depth > 0 ? themed($nested) : undefined}>
      {dnf.map((group, gi) => {
        const codes = Array.isArray(group) ? group : [group]
        return (
          <View key={`${gi}-${codes.join("+")}`}>
            {gi > 0 && (
              <View style={$orRow}>
                <Text text="or" size="xxs" weight="medium" style={themed($orText)} />
              </View>
            )}
            <View style={$andGroup}>
              {codes.map((code, ci) => (
                <View key={code} style={$andItem}>
                  {codes.length > 1 && (
                    <Text
                      text={ci === 0 ? "" : "+"}
                      size="xs"
                      weight="bold"
                      style={themed($andMark)}
                    />
                  )}
                  <View style={$andItemBody}>
                    <PrereqNode
                      code={code}
                      term={term}
                      path={path}
                      depth={depth}
                      onOpenCourse={onOpenCourse}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )
      })}
    </View>
  )
}

interface PrereqNodeProps {
  code: string
  term: string
  path: string[]
  depth: number
  onOpenCourse: (code: string) => void
}

const PrereqNode: FC<PrereqNodeProps> = ({ code, term, path, depth, onOpenCourse }) => {
  const { themed } = useAppTheme()
  const [expanded, setExpanded] = useState(false)
  const course = resolveCourse(code, term)
  const inPath = path.includes(code)
  const childDnf = inPath || !expanded ? undefined : resolveDetail(code, term)?.pqd
  const canExpand = !inPath && !!resolveDetail(code, term)?.pqd?.length

  return (
    <View>
      <View style={$nodeRow}>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          disabled={!canExpand}
          hitSlop={8}
          style={$chevronHit}
          accessibilityRole="button"
          accessibilityLabel={expanded ? `Collapse ${code}` : `Expand ${code}`}
        >
          <Text
            text={inPath ? "↻" : canExpand ? (expanded ? "▾" : "▸") : "·"}
            size="xs"
            style={[themed($chevron), inPath && themed($cycleMark)]}
          />
        </Pressable>
        <Pressable onPress={() => onOpenCourse(code)} style={$nodeBody} hitSlop={4}>
          <Text text={code} size="xs" weight="bold" style={themed($nodeCode)} />
          {course ? (
            <Text text={course.t} size="xxs" numberOfLines={1} style={themed($nodeTitle)} />
          ) : (
            <Text text="not in catalog" size="xxs" style={themed($nodeMissing)} />
          )}
        </Pressable>
      </View>
      {childDnf && (
        <PrereqTree
          dnf={childDnf}
          term={term}
          onOpenCourse={onOpenCourse}
          path={[...path, code]}
          depth={depth + 1}
        />
      )}
    </View>
  )
}

const $nested: ThemedStyle<ViewStyle> = (theme) => ({
  marginLeft: 14,
  paddingLeft: 10,
  borderLeftWidth: 2,
  borderLeftColor: theme.colors.primaryBorder,
  marginTop: 4,
})

const $orRow: ViewStyle = {
  paddingVertical: 2,
  paddingLeft: 2,
}

const $orText: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
  fontStyle: "italic",
})

const $andGroup: ViewStyle = {
  gap: 2,
}

const $andItem: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
}

const $andMark: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
  width: 12,
})

const $andItemBody: ViewStyle = {
  flex: 1,
}

const $nodeRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 3,
}

const $chevronHit: ViewStyle = {
  width: 22,
  alignItems: "center",
}

const $chevron: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.primary,
})

const $cycleMark: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
})

const $nodeBody: ViewStyle = {
  flex: 1,
  flexDirection: "row",
  alignItems: "baseline",
  gap: 6,
  flexWrap: "wrap",
}

const $nodeCode: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.primary,
})

const $nodeTitle: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textSecondary,
  flexShrink: 1,
})

const $nodeMissing: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
  fontStyle: "italic",
})
