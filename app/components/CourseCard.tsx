import { FC, memo } from "react"
import { Pressable, View, ViewStyle } from "react-native"

import { Text } from "@/components/Text"
import type { CourseRow } from "@/services/courses"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface CourseCardProps {
  course: CourseRow
  onPress: (code: string) => void
}

/**
 * Course list card — a mobile take on rouste's `.course-card`: code and
 * credit badge on the first row, title underneath, small metadata badges
 * for prerequisites / Common Core.
 */
export const CourseCard: FC<CourseCardProps> = memo(function CourseCard({ course, onPress }) {
  const { themed } = useAppTheme()

  return (
    <Pressable
      onPress={() => onPress(course.c)}
      style={({ pressed }) => [themed($card), pressed && themed($cardPressed)]}
      accessibilityRole="button"
      accessibilityLabel={`${course.c} ${course.t}`}
    >
      <View style={$header}>
        <Text text={course.c} size="sm" weight="bold" style={themed($code)} />
        <View style={$meta}>
          {course.cc.length > 0 && (
            <View style={themed($ccBadge)}>
              <Text text="Common Core" size="xxs" weight="semiBold" style={themed($ccBadgeText)} />
            </View>
          )}
          {course.cr != null && (
            <View style={themed($creditBadge)}>
              <Text
                text={`${course.cr} ${course.cr === 1 ? "Credit" : "Credits"}`}
                size="xxs"
                weight="medium"
                style={themed($creditBadgeText)}
              />
            </View>
          )}
        </View>
      </View>

      <Text text={course.t} size="xs" weight="semiBold" style={themed($title)} numberOfLines={2} />

      {(course.pr === 1 || course.cq === 1) && (
        <View style={$badgeRow}>
          {course.pr === 1 && (
            <View style={themed($neutralBadge)}>
              <Text text="Prerequisites" size="xxs" style={themed($neutralBadgeText)} />
            </View>
          )}
          {course.cq === 1 && (
            <View style={themed($neutralBadge)}>
              <Text text="Co-requisite" size="xxs" style={themed($neutralBadgeText)} />
            </View>
          )}
        </View>
      )}
    </Pressable>
  )
})

const $card: ThemedStyle<ViewStyle> = (theme) => ({
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 8,
  paddingHorizontal: 14,
  paddingVertical: 12,
  backgroundColor: theme.colors.surface,
})

const $cardPressed: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.surfaceVariant,
})

const $header: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
}

const $meta: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  flexShrink: 1,
}

const $code: ThemedStyle<{ color: string }> = (theme) => ({
  color: theme.colors.primary,
  letterSpacing: 0.3,
})

const $creditBadge: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.primaryLight,
  borderRadius: 4,
  paddingHorizontal: 8,
  paddingVertical: 3,
})

const $creditBadgeText: ThemedStyle<{ color: string }> = (theme) => ({
  color: theme.colors.primaryDark,
})

const $ccBadge: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.secondaryLight,
  borderRadius: 4,
  paddingHorizontal: 8,
  paddingVertical: 3,
})

const $ccBadgeText: ThemedStyle<{ color: string }> = (theme) => ({
  color: theme.colors.secondaryDark,
})

const $title: ThemedStyle<{ color: string }> = (theme) => ({
  color: theme.colors.text,
  marginTop: 6,
})

const $badgeRow: ViewStyle = {
  flexDirection: "row",
  gap: 6,
  marginTop: 8,
}

const $neutralBadge: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.surfaceVariant,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 4,
  paddingHorizontal: 8,
  paddingVertical: 2,
})

const $neutralBadgeText: ThemedStyle<{ color: string }> = (theme) => ({
  color: theme.colors.textSecondary,
})
