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
 * Recursive prerequisite tree with the boolean structure made explicit
 * instead of implied by punctuation:
 *
 *   - every OR alternative is its own "Option n · all of" card, separated
 *     from the next by an `or` divider,
 *   - courses inside a card are joined by an `and` label,
 *   - a single AND group renders as a plain "All of the following" list,
 *   - a single course renders as a single node.
 *
 * Every course is tappable — the label opens the course detail, the chevron
 * expands that course's own prerequisites in place. `path` carries the
 * ancestors of the current branch so cycles and repeated courses terminate.
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

  const multipleOptions = dnf.length > 1
  const groups = dnf.map((group) => (Array.isArray(group) ? group : [group]))
  const soleGroup = groups[0] ?? []

  return (
    <View style={depth > 0 ? themed($nested) : undefined}>
      {multipleOptions && (
        <Text
          text={`Any one of these ${dnf.length} options:`}
          size="xxs"
          weight="semiBold"
          style={themed($listHeader)}
        />
      )}
      {!multipleOptions && soleGroup.length > 1 && (
        <Text text="All of the following:" size="xxs" weight="semiBold" style={themed($listHeader)} />
      )}

      {groups.map((codes, gi) => (
        <View key={`${gi}-${codes.join("+")}`}>
          {gi > 0 && (
            <View style={$orDivider}>
              <View style={themed($orLine)} />
              <Text text="or" size="xs" weight="bold" style={themed($orLabel)} />
              <View style={themed($orLine)} />
            </View>
          )}
          <View style={multipleOptions ? themed($optionCard) : $plainGroup}>
            {multipleOptions && (
              <Text
                text={`Option ${gi + 1}`}
                size="xxs"
                weight="semiBold"
                style={themed($optionLabel)}
              />
            )}
            {codes.map((code, ci) => (
              <View key={code}>
                {ci > 0 && (
                  <View style={$andRow}>
                    <Text text="and" size="xxs" weight="medium" style={themed($andLabel)} />
                  </View>
                )}
                <PrereqNode
                  code={code}
                  term={term}
                  path={path}
                  depth={depth}
                  onOpenCourse={onOpenCourse}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
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
  const detail = resolveDetail(code, term)
  const canExpand = !inPath && !!detail?.pqd?.length
  const childDnf = inPath || !expanded ? undefined : detail?.pqd

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

const $listHeader: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textSecondary,
  marginBottom: 6,
})

const $orDivider: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  marginVertical: 8,
}

const $orLine: ThemedStyle<ViewStyle> = (theme) => ({
  flex: 1,
  height: 1,
  backgroundColor: theme.colors.secondaryBorder,
})

const $orLabel: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.secondaryDark,
  letterSpacing: 1,
})

const $optionCard: ThemedStyle<ViewStyle> = (theme) => ({
  borderWidth: 1,
  borderColor: theme.colors.secondaryBorder,
  backgroundColor: theme.colors.surface,
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 8,
  gap: 2,
})

const $optionLabel: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.secondaryDark,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 2,
})

const $plainGroup: ViewStyle = { gap: 2 }

const $andRow: ViewStyle = {
  paddingLeft: 22,
  paddingVertical: 1,
}

const $andLabel: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
  fontStyle: "italic",
})

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
