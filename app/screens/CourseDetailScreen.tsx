import { FC, ReactNode, useMemo, useState } from "react"
import { Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"

import { DependencyGraph } from "@/components/DependencyGraph"
import { PrereqTree } from "@/components/PrereqTree"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import {
  extractCodes,
  getCourse,
  getTerms,
  getUnlocks,
  isDnfSatisfied,
  resolveCourse,
  resolveDetail,
} from "@/services/courses"
import {
  toggleCompleted,
  toggleFavourite,
  useCompleted,
  useFavourites,
} from "@/services/preferences"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

/**
 * Course detail — description, CILOs, catalog attributes, prerequisites
 * rendered as a recursive DNF tree, and the reverse "unlocks" list.
 *
 * All fields are resolved for the selected term so that requirements are
 * shown exactly as they stood in that term.
 */
export const CourseDetailScreen: FC<AppStackScreenProps<"CourseDetail">> = ({
  route,
  navigation,
}) => {
  const { code, term } = route.params
  const { themed } = useAppTheme()
  const [showAllUnlocks, setShowAllUnlocks] = useState(false)
  const favourites = useFavourites()
  const completed = useCompleted()
  const completedSet = useMemo(() => new Set(completed), [completed])
  const isFav = favourites.includes(code)
  const isDone = completed.includes(code)

  const course = resolveCourse(code, term)
  const detail = resolveDetail(code, term)
  const prereqMet = isDnfSatisfied(detail?.pqd, completedSet)
  const unlocks = useMemo(() => getUnlocks(code), [code])
  const terms = getTerms()
  const termName = terms.find((t) => t.code === term)?.name ?? term
  const offeredInTerm = course?.tm.includes(term) ?? false

  const openCourse = (next: string) => navigation.push("CourseDetail", { code: next, term })

  if (!course) {
    return (
      <View style={themed($screen)}>
        <View style={themed($header)}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text text={code} size="md" weight="bold" style={themed($headerTitle)} />
        </View>
        <View style={$empty}>
          <Text
            text={`${code} is referenced by other courses but is not in the dataset.`}
            size="sm"
            style={themed($muted)}
          />
        </View>
      </View>
    )
  }

  const exclusions = extractCodes(detail?.ex)
  const unlockList = showAllUnlocks ? unlocks : unlocks.slice(0, 12)

  return (
    <View style={themed($screen)}>
      <View style={themed($header)}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={$headerText}>
          <Text text={course.c} size="md" weight="bold" style={themed($headerCode)} />
          <Text text={termName} size="xxs" style={themed($muted)} />
        </View>
        <Pressable
          onPress={() => toggleCompleted(code)}
          hitSlop={6}
          style={({ pressed }) => [themed(isDone ? $takenChip : $actionChip), pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={isDone ? "Mark as not taken" : "Mark as taken"}
          accessibilityState={{ selected: isDone }}
        >
          <Text
            text={isDone ? "✓ Taken" : "Taken?"}
            size="xxs"
            weight="semiBold"
            style={themed(isDone ? $takenChipText : $actionChipText)}
          />
        </Pressable>
        <Pressable
          onPress={() => toggleFavourite(code)}
          hitSlop={8}
          style={$starButton}
          accessibilityRole="button"
          accessibilityLabel={isFav ? "Remove from favourites" : "Add to favourites"}
          accessibilityState={{ selected: isFav }}
        >
          <Text text={isFav ? "★" : "☆"} size="lg" style={themed(isFav ? $starOn : $starOff)} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={themed($content)}>
        {/* ---- identity ------------------------------------------- */}
        <View style={themed($card)}>
          <Text text={course.t} size="md" weight="bold" style={themed($title)} />
          <View style={$badgeRow}>
            {course.cr != null && (
              <Badge text={`${course.cr} Credits`} tone="primary" />
            )}
            <Badge text={course.p} tone="neutral" />
            <Badge text={`Level ${course.lv}`} tone="neutral" />
          </View>
          <Text
            text={`Offered in: ${course.tm
              .map((t) => terms.find((x) => x.code === t)?.name ?? t)
              .join(", ")}`}
            size="xxs"
            style={themed($muted)}
          />
          {!offeredInTerm && (
            <View style={themed($notice)}>
              <Text
                text={`Not offered in ${termName} — showing data for the newest term it ran in.`}
                size="xxs"
                style={themed($noticeText)}
              />
            </View>
          )}
        </View>

        {/* ---- attributes ----------------------------------------- */}
        {detail?.at && detail.at.length > 0 && (
          <Section title="Catalog Attributes">
            {detail.at.map((a) => (
              <View key={`${a.l}-${a.v}`} style={$attrRow}>
                <Badge text={a.l} tone={a.l.startsWith("CC") || a.l === "4Y" ? "gold" : "neutral"} />
                <Text text={a.d} size="xxs" style={[themed($muted), $attrText]} />
              </View>
            ))}
          </Section>
        )}

        {/* ---- prerequisites -------------------------------------- */}
        <Section title="Prerequisites">
          {detail?.pq ? (
            <>
              {detail.pqd && detail.pqd.length > 0 && (
                <View style={themed(prereqMet ? $metBadge : $unmetBadge)}>
                  <Text
                    text={
                      prereqMet
                        ? "✓ Prerequisites met by your completed courses"
                        : "Not met yet — mark courses as taken to check"
                    }
                    size="xxs"
                    weight="semiBold"
                    style={themed(prereqMet ? $metBadgeText : $unmetBadgeText)}
                  />
                </View>
              )}
              <View style={themed($quoteBox)}>
                <Text text={detail.pq} size="xs" style={themed($quoteText)} />
              </View>
              {detail.pqd && detail.pqd.length > 0 ? (
                <View style={$treeWrap}>
                  <PrereqTree
                    dnf={detail.pqd}
                    term={term}
                    onOpenCourse={openCourse}
                  />
                </View>
              ) : (
                <Text
                  text="No course-code prerequisites — the requirement is stated in the text above (e.g. public-exam scores or standing)."
                  size="xxs"
                  style={themed($muted)}
                />
              )}
              {detail.pqx === 1 && detail.pqd && detail.pqd.length > 0 && (
                <Text
                  text="The text also contains conditions that are not courses (exam scores, standing); the tree shows the course-based part only."
                  size="xxs"
                  style={themed($muted)}
                />
              )}
            </>
          ) : (
            <Text text="No prerequisites." size="xs" style={themed($body)} />
          )}
        </Section>

        {/* ---- dependency graph ----------------------------------- */}
        {detail?.pqd && detail.pqd.length > 0 && (
          <Section title="Dependency Graph">
            <DependencyGraph
              code={code}
              term={term}
              onOpenCourse={openCourse}
              completed={completed}
            />
          </Section>
        )}

        {/* ---- corequisites / exclusions -------------------------- */}
        {detail?.cq ? (
          <Section title="Co-requisites">
            <View style={themed($quoteBox)}>
              <Text text={detail.cq} size="xs" style={themed($quoteText)} />
            </View>
            {detail.cqd && detail.cqd.length > 0 && (
              <View style={$treeWrap}>
                <PrereqTree dnf={detail.cqd} term={term} onOpenCourse={openCourse} />
              </View>
            )}
          </Section>
        ) : null}

        {exclusions.length > 0 && (
          <Section title="Exclusions">
            <View style={$chips}>
              {exclusions.map((x) => (
                <Pressable key={x} onPress={() => openCourse(x)} hitSlop={4}>
                  <View style={themed($chip)}>
                    <Text text={x} size="xxs" weight="semiBold" style={themed($chipText)} />
                  </View>
                </Pressable>
              ))}
            </View>
          </Section>
        )}

        {/* ---- unlocks -------------------------------------------- */}
        <Section title={`Unlocks (${unlocks.length})`}>
          {unlocks.length === 0 ? (
            <Text
              text="No course in the dataset lists this one as a prerequisite."
              size="xxs"
              style={themed($muted)}
            />
          ) : (
            <>
              <View style={$chips}>
                {unlockList.map((u) => {
                  const c = getCourse(u)
                  return (
                    <Pressable key={u} onPress={() => openCourse(u)} hitSlop={4}>
                      <View style={themed($chip)}>
                        <Text
                          text={c ? `${u} · ${c.t}` : u}
                          size="xxs"
                          style={themed($chipText)}
                          numberOfLines={1}
                        />
                      </View>
                    </Pressable>
                  )
                })}
              </View>
              {unlocks.length > 12 && !showAllUnlocks && (
                <Pressable onPress={() => setShowAllUnlocks(true)} hitSlop={6}>
                  <Text
                    text={`Show all ${unlocks.length}`}
                    size="xxs"
                    weight="semiBold"
                    style={themed($link)}
                  />
                </Pressable>
              )}
            </>
          )}
        </Section>

        {/* ---- description ---------------------------------------- */}
        {detail?.d && (
          <Section title="Description">
            <Text text={detail.d} size="xs" style={themed($body)} />
          </Section>
        )}

        {/* ---- CILOs ---------------------------------------------- */}
        {detail?.cl && detail.cl.length > 0 && (
          <Section title="Intended Learning Outcomes">
            {detail.cl.map((c, i) => (
              <View key={i} style={$ciloRow}>
                <Text text={`${i + 1}.`} size="xs" weight="semiBold" style={themed($muted)} />
                <Text text={c} size="xs" style={[themed($body), $ciloText]} />
              </View>
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  )
}

// ---------------------------------------------------------------------------

const BackButton: FC<{ onPress: () => void }> = ({ onPress }) => {
  const { themed } = useAppTheme()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={$backButton}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Text text="‹" size="xl" weight="bold" style={themed($link)} />
    </Pressable>
  )
}

const Badge: FC<{ text: string; tone: "primary" | "gold" | "neutral" }> = ({ text, tone }) => {
  const { themed } = useAppTheme()
  const style = tone === "primary" ? $badgePrimary : tone === "gold" ? $badgeGold : $badgeNeutral
  const textStyle =
    tone === "primary" ? $badgePrimaryText : tone === "gold" ? $badgeGoldText : $badgeNeutralText
  return (
    <View style={themed(style)}>
      <Text text={text} size="xxs" weight="semiBold" style={themed(textStyle)} />
    </View>
  )
}

const Section: FC<{ title: string; children: ReactNode }> = ({ title, children }) => {
  const { themed } = useAppTheme()
  return (
    <View style={themed($card)}>
      <Text text={title} size="sm" weight="bold" style={themed($sectionTitle)} />
      <View style={$sectionBody}>{children}</View>
    </View>
  )
}

// ---------------------------------------------------------------------------

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

const $headerText: ViewStyle = { flex: 1 }
const $headerTitle: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.text })
const $headerCode: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.primary })

const $content: ThemedStyle<ViewStyle> = (theme) => ({
  padding: 14,
  gap: 12,
  paddingBottom: 40,
})

const $card: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.surface,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 12,
  padding: 14,
  gap: 8,
})

const $title: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.text })

const $sectionTitle: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textSecondary,
  textTransform: "uppercase",
  letterSpacing: 0.6,
})

const $sectionBody: ViewStyle = { gap: 8 }

const $badgeRow: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 6 }

const $badgePrimary: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.primaryLight,
  borderRadius: 4,
  paddingHorizontal: 8,
  paddingVertical: 3,
})
const $badgePrimaryText: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.primaryDark })

const $badgeGold: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.secondaryLight,
  borderRadius: 4,
  paddingHorizontal: 8,
  paddingVertical: 3,
})
const $badgeGoldText: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.secondaryDark })

const $badgeNeutral: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.surfaceVariant,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 4,
  paddingHorizontal: 8,
  paddingVertical: 3,
})
const $badgeNeutralText: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textSecondary,
})

const $muted: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.textMuted })
const $body: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.text,
  lineHeight: 20,
})
const $link: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.primary })

const $notice: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.warningLight,
  borderRadius: 6,
  paddingHorizontal: 10,
  paddingVertical: 6,
})

const $noticeText: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.warning })

const $quoteBox: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.surfaceVariant,
  borderLeftWidth: 3,
  borderLeftColor: theme.colors.primaryBorder,
  borderRadius: 4,
  paddingHorizontal: 10,
  paddingVertical: 8,
})

const $quoteText: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textSecondary,
  fontStyle: "italic",
})

const $treeWrap: ViewStyle = { marginTop: 2 }

const $chips: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 6 }

const $chip: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.surfaceVariant,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 4,
  maxWidth: 260,
})

const $chipText: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.textSecondary })

const $attrRow: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 8 }
const $attrText: ViewStyle = { flex: 1 }

const $actionChip: ThemedStyle<ViewStyle> = (theme) => ({
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 6,
  paddingHorizontal: 8,
  paddingVertical: 4,
})

const $actionChipText: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.textSecondary,
})

const $takenChip: ThemedStyle<ViewStyle> = (theme) => ({
  borderWidth: 1,
  borderColor: theme.colors.success,
  backgroundColor: theme.colors.successLight,
  borderRadius: 6,
  paddingHorizontal: 8,
  paddingVertical: 4,
})

const $takenChipText: ThemedStyle<TextStyle> = (theme) => ({
  color: theme.colors.success,
})

const $starButton: ViewStyle = {
  width: 34,
  height: 34,
  alignItems: "center",
  justifyContent: "center",
}

const $starOn: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.secondary })
const $starOff: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.textMuted })

const $metBadge: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.successLight,
  borderWidth: 1,
  borderColor: theme.colors.success,
  borderRadius: 6,
  paddingHorizontal: 10,
  paddingVertical: 6,
})

const $metBadgeText: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.success })

const $unmetBadge: ThemedStyle<ViewStyle> = (theme) => ({
  backgroundColor: theme.colors.surfaceVariant,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 6,
  paddingHorizontal: 10,
  paddingVertical: 6,
})

const $unmetBadgeText: ThemedStyle<TextStyle> = (theme) => ({ color: theme.colors.textSecondary })

const $ciloRow: ViewStyle = { flexDirection: "row", gap: 6 }
const $ciloText: ViewStyle = { flex: 1 }

const $empty: ViewStyle = { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 }
