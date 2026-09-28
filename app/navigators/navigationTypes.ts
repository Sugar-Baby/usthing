import { ComponentProps } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"

// App Stack Navigator types
export type AppStackParamList = {
  /** Department menu + search (the full-screen port of rouste's side menu) */
  Courses: undefined
  /** Courses of one department, Common Core, or the whole catalog */
  CourseList: { term: string; prefix?: string; commonCore?: boolean }
  /** Course detail with the recursive prerequisite tree */
  CourseDetail: { code: string; term: string }
}

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>

export interface NavigationProps extends Partial<
  ComponentProps<typeof NavigationContainer<AppStackParamList>>
> {}
