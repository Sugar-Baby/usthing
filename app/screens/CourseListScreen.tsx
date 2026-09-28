import { FC, useMemo } from "react"
import { FlatList, Pressable, TextStyle, View, ViewStyle } from "react-native"

import { CourseCard } from "@/components/CourseCard"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { getDepartmentName, getTerms, queryCourses } from "@/services/courses"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

/**
 * Courses of one department (or Common Core / all courses), the mobile
 * counterpart of rouste's `.course-panel`.
 */
export const CourseListScreen: FC<AppStackScreenProps<"CourseList">> = ({ route, navigation }) => {
  const { themed } = useAppTheme()
  const { term, prefix, commonCore } = route.params

  const termName = getTerms().find((t) => t.code === term)?.name ?? term
  const courses = useMemo(
    () => queryCourses({ term, prefix, commonCore }),
    [term, prefix, commonCore],
  )

  const title = commonCore
    ? "Common Core"
    : prefix
      ? `${prefix} Courses`
      : "All Courses"

  const subtitle = prefix
    ? `${getDepartmentName(prefix)} · ${termName}`
    : termName

  const openCourse = (code: string) => navigation.navigate("CourseDetail", { code, term })

  return (
    <View style={themed($screen)}>
      <View style={themed($header)}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={$backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text text="‹" size="xl" weight="bold" style={themed($backIcon)} />
        </Pressable>
        <View style={$headerText}>
          <Text text={title} size="md" weight="bold" style={themed($headerTitle)} />
          <Text
            text={`${subtitle} · ${courses.length} course${courses.length === 1 ? "" : "s"}`}
            size="xxs"
            style={themed($headerSubtitle)}
          />
        </View>
      </View>

      <FlatList
        data={courses}
        keyExtractor={(item) => item.c}
        renderItem={({ item }) => <CourseCard course={item} onPress={openCourse} />}
        contentContainerStyle={themed($listContent)}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={11}
        ListEmptyComponent={
          <View style={$empty}>
            <Text text="No courses found for this selection." size="sm" style={themed($emptyText)} />
          </View>
        }
      />
    </View>
  )
}

const $screen: ThemedStyle<ViewStyle> = (theme) => ({
  flex: 1,
  backgroundColor: theme.colors.background,
})

const $header: ThemedStyle<ViewStyle> = (theme) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingHorizontal: 10,
  paddingTop: 6,
  paddingBottom: 10,
  backgroundColor: theme.colors.surface,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
})

const $backButton: ViewStyle = {
  width: 36,
  height: 36,
  alignItems: "center",
  justifyContent: "center",
}

const $backIcon: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.primary,
})

const $headerText: ViewStyle = { flex: 1 }

const $headerTitle: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.text,
})

const $headerSubtitle: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
})

const $listContent: ThemedStyle<ViewStyle> = (theme) => ({
  padding: 14,
  gap: 10,
  paddingBottom: 32,
})

const $empty: ViewStyle = { alignItems: "center", paddingTop: 40 }

const $emptyText: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
})
