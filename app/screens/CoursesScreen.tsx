import { FC, useMemo, useState } from "react"
import {
  FlatList,
  Modal,
  Pressable,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import { CourseCard } from "@/components/CourseCard"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { getTerms, prefixCounts, queryCourses, termStats } from "@/services/courses"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

/**
 * Home screen — the department menu from rouste's `.department-menu`,
 * reproduced for a full mobile screen: brand header, term selector, search
 * box, Common Core shortcut and the department grid. Typing switches the
 * screen from the department grid to live search results.
 */
export const CoursesScreen: FC<AppStackScreenProps<"Courses">> = ({ navigation }) => {
  const { themed } = useAppTheme()
  const terms = getTerms()
  const [term, setTerm] = useState(terms[0]?.code ?? "")
  const [text, setText] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)

  const termName = terms.find((t) => t.code === term)?.name ?? term
  const stats = useMemo(() => termStats(term), [term])
  const prefixes = useMemo(() => prefixCounts(term), [term])
  const results = useMemo(() => queryCourses({ term, text }), [term, text])

  const searching = text.trim().length > 0

  const openCourse = (code: string) => navigation.navigate("CourseDetail", { code, term })

  return (
    <View style={themed($screen)}>
      {/* ---- header ------------------------------------------------ */}
      <View style={themed($header)}>
        <View style={$brandRow}>
          <View style={$brand}>
            <Text text="HK" size="xl" weight="bold" style={themed($brandBlue)} />
            <Text text="UST" size="xl" weight="bold" style={themed($brandGold)} />
            <Text text=" Courses" size="xl" weight="bold" style={themed($brandBlue)} />
          </View>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [themed($termButton), pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel="Select term"
          >
            <Text text={termName} size="xxs" weight="semiBold" style={themed($termButtonText)} />
            <Text text="▾" size="xxs" style={themed($termButtonText)} />
          </Pressable>
        </View>

        <View style={themed($searchBox)}>
          <Text text="⌕" size="md" style={themed($searchIcon)} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search course code or title"
            placeholderTextColor={themed($searchPlaceholder).color}
            autoCorrect={false}
            autoCapitalize="characters"
            returnKeyType="search"
            style={themed($searchInput)}
          />
          {searching && (
            <Pressable onPress={() => setText("")} hitSlop={10}>
              <Text text="✕" size="sm" style={themed($searchIcon)} />
            </Pressable>
          )}
        </View>

        <Text
          size="xxs"
          style={themed($statsLine)}
          text={
            searching
              ? `${results.length} result${results.length === 1 ? "" : "s"} in ${termName}`
              : `${stats.total.toLocaleString()} courses · ${stats.withPrereq} with prerequisites · ${stats.commonCore} Common Core`
          }
        />
      </View>

      {/* ---- body -------------------------------------------------- */}
      {searching ? (
        <FlatList
          data={results}
          key="results"
          keyExtractor={(item) => item.c}
          renderItem={({ item }) => <CourseCard course={item} onPress={openCourse} />}
          contentContainerStyle={themed($listContent)}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={16}
          windowSize={11}
          ListEmptyComponent={
            <View style={$empty}>
              <Text text="No courses match your search." size="sm" style={themed($emptyText)} />
            </View>
          }
        />
      ) : (
        <FlatList
          data={prefixes}
          key="departments"
          keyExtractor={(item) => item.code}
          numColumns={3}
          columnWrapperStyle={$gridRow}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate("CourseList", { prefix: item.code, term })}
              style={({ pressed }) => [themed($deptButton), pressed && themed($deptButtonPressed)]}
              accessibilityRole="button"
            >
              <Text text={item.code} size="xs" weight="semiBold" style={themed($deptCode)} />
              <Text
                text={`${item.count} course${item.count === 1 ? "" : "s"}`}
                size="xxs"
                style={themed($deptCount)}
              />
            </Pressable>
          )}
          contentContainerStyle={themed($listContent)}
          initialNumToRender={24}
          ListHeaderComponent={
            <View style={$shortcuts}>
              <Pressable
                onPress={() => navigation.navigate("CourseList", { commonCore: true, term })}
                style={({ pressed }) => [themed($ccButton), pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <Text text="Common Core" size="sm" weight="bold" style={themed($ccButtonText)} />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate("CourseList", { term })}
                style={({ pressed }) => [themed($allButton), pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <Text text="All Courses" size="sm" weight="bold" style={themed($allButtonText)} />
              </Pressable>
              <Text text="Courses offered by departments" size="xxs" style={themed($sectionLabel)} />
            </View>
          }
        />
      )}

      {/* ---- term picker ------------------------------------------- */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={$modalBackdrop} onPress={() => setPickerOpen(false)}>
          <View style={themed($modalSheet)}>
            <Text text="Term" size="xxs" weight="semiBold" style={themed($modalTitle)} />
            {terms.map((t) => {
              const active = t.code === term
              return (
                <Pressable
                  key={t.code}
                  onPress={() => {
                    setTerm(t.code)
                    setPickerOpen(false)
                  }}
                  style={({ pressed }) => [
                    themed($termRow),
                    active && themed($termRowActive),
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    text={t.name}
                    size="sm"
                    weight={active ? "bold" : "normal"}
                    style={themed(active ? $termRowTextActive : $termRowText)}
                  />
                  <Text text={t.code} size="xxs" style={themed($termRowCode)} />
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

// ---------------------------------------------------------------------------

const $screen: ThemedStyle<ViewStyle> = (theme) => ({
  flex: 1,
  backgroundColor: theme.colors.background,
})

const $header: ThemedStyle<ViewStyle> = (theme) => ({
  paddingHorizontal: 14,
  paddingTop: 8,
  paddingBottom: 10,
  backgroundColor: theme.colors.surface,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
  gap: 10,
})

const $brandRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
}

const $brand: ViewStyle = { flexDirection: "row", alignItems: "baseline" }
const $brandBlue: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.primary })
const $brandGold: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.secondary })

const $termButton: ThemedStyle<ViewStyle> = (theme) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  backgroundColor: theme.colors.primaryLight,
  borderWidth: 1,
  borderColor: theme.colors.primaryBorder,
  borderRadius: 6,
  paddingHorizontal: 10,
  paddingVertical: 6,
})

const $termButtonText: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.primaryDark,
})

const $searchBox: ThemedStyle<ViewStyle> = (theme) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  backgroundColor: theme.colors.surfaceVariant,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 8,
  paddingHorizontal: 12,
})

const $searchIcon: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
})

const $searchInput: ThemedStyle<TextStyle> = (theme) => ({
  flex: 1,
  paddingVertical: 10,
  fontSize: 15,
  color: theme.colors.text,
})

const $searchPlaceholder: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
})

const $statsLine: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
})

const $listContent: ThemedStyle<ViewStyle> = (theme) => ({
  padding: 14,
  gap: 10,
  paddingBottom: 32,
})

const $shortcuts: ViewStyle = {
  gap: 8,
  marginBottom: 6,
}

const $ccButton: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.secondaryLight,
  borderWidth: 1,
  borderColor: theme.colors.secondaryBorder,
  borderRadius: 6,
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
})

const $ccButtonText: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.secondaryDark,
})

const $allButton: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.primaryLight,
  borderWidth: 1,
  borderColor: theme.colors.primaryBorder,
  borderRadius: 6,
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
})

const $allButtonText: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.primaryDark,
})

const $sectionLabel: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
  marginTop: 8,
  textTransform: "uppercase",
  letterSpacing: 0.6,
})

const $gridRow: ViewStyle = { gap: 8 }

const $deptButton: ThemedStyle<ViewStyle> = (theme) => ({
  flex: 1,
  backgroundColor: theme.colors.surface,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 6,
  minHeight: 56,
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  paddingHorizontal: 6,
})

const $deptButtonPressed: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.primaryLight,
  borderColor: theme.colors.primaryBorder,
})

const $deptCode: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.text,
  letterSpacing: 0.3,
})

const $deptCount: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
})

const $empty: ViewStyle = { alignItems: "center", paddingTop: 40 }

const $emptyText: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
})

const $modalBackdrop: ViewStyle = {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.35)",
  justifyContent: "center",
  paddingHorizontal: 40,
}

const $modalSheet: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.surface,
  borderRadius: 12,
  padding: 12,
  gap: 6,
  borderWidth: 1,
  borderColor: theme.colors.border,
})

const $modalTitle: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textMuted,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  marginBottom: 2,
  paddingHorizontal: 8,
})

const $termRow: ThemedStyle<ViewStyle> = (theme) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 12,
  paddingVertical: 12,
  borderRadius: 8,
  backgroundColor: theme.colors.surfaceVariant,
})

const $termRowActive: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.primaryLight,
  borderWidth: 1,
  borderColor: theme.colors.primaryBorder,
})

const $termRowText: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.text })
const $termRowTextActive: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.primaryDark })
const $termRowCode: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.textMuted })
