# Question Bank — Mobile Interactive Question Bank

> This file is read on demand by SKILL.md in Phase 2. The AI must strictly follow the group order defined in this file, asking **one group at a time (1–3 questions)**, never dumping all questions at once.
> For every question, show the user: question number, question text, options, **recommended choice (marked "Recommended")**, and a one-line description.
> After each user response, immediately record the choice to internal state `answers[Qx] = ...` and proceed to the next group.

---

## Asking Rules

1. **Group order**: G1 → G2 → G3 → G4 → G5 → G6 → G7 → G8 → G9 → G10. Do not skip.
2. **Shortcut commands** (respond immediately when user types these at any point):
   - `recommended` / `default` → skip current group, adopt all recommended options
   - `all recommended` / `one-click` → skip all remaining groups, adopt all recommended options
   - `strict` / `strictest` → adopt the strictest option for the current group
   - `skip` / `don't need this` → mark current group as N/A
   - `custom: xxx` → record user's custom content
3. **Abbreviation recognition**: `A` / `a` / `1` all mean option A. `A,C` means multi-select (only for multi-select questions).
4. **Follow-up rule**: If the user gives an answer outside the options, first confirm whether to classify as an "other" branch.
5. **Forbidden behaviors**:
   - Must not make choices for the user before they explicitly answer.
   - Must not fabricate user preferences to complete the answer set.
   - Must not output more than 3 questions in a single message.

---

## Group Overview

| Group | Topic | Questions | Count |
|-------|-------|-----------|-------|
| G1 | Platform & Language | Q1–Q2 | 2 |
| G2 | Architecture | Q3 | 1 |
| G3 | UI Framework | Q4 | 1 |
| G4 | Navigation & State | Q5–Q6 | 2 |
| G5 | Networking & Data | Q7–Q8 | 2 |
| G6 | Platform Features | Q9–Q11 | 3 |
| G7 | Testing | Q12–Q14 | 3 |
| G8 | App Distribution | Q15 | 1 |
| G9 | Performance & Accessibility | Q16–Q17 | 2 |
| G10 | AI Constraints | Q18–Q20 | 3 |

Total: 20 questions.

---

## G1 — Platform & Language

### Q1. Target Platform
- **Options**:
  - A) Flutter (Dart) **【Recommended: best cross-platform coverage, single codebase】**
  - B) React Native (TypeScript)
  - C) iOS native (Swift)
  - D) Android native (Kotlin)
  - E) Both native (Swift + Kotlin, separate codebases)
- **Note**: Determines all subsequent framework, tooling, and platform-specific rule injections.
- **Dual-native note**: If Q1=E (Both native): present Q4/Q6/Q7/Q8/Q13/Q14 for iOS first, then ask the user if they want to repeat for Android (or apply same choices).
- **Maps to**: `{{ platform }}` + `{{ tech_stack_rules }}`

### Q2. Minimum OS Version
- **Options**:
  - A) Latest - 1 (iOS 17+ / Android 14+) **【Recommended: covers ~90% of active devices】**
  - B) Latest - 2 (iOS 16+ / Android 13+)
  - C) Latest - 3 (wider compatibility, more legacy handling)
- **Note**: Determines API availability and deprecation handling rules.
- **Maps to**: `{{ min_os_version }}` + `{{ tech_stack_rules }}`

---

## G2 — Architecture

### Q3. Architecture Pattern
- **Options**:
  - A) MVVM (Model-View-ViewModel) **【Recommended: platform-agnostic, testable】**
  - B) Clean Architecture (Use Case / Repository / Data Source layers)
  - C) Redux-style / MVI (unidirectional data flow)
  - D) Simple MVC (small projects, no over-engineering)
- **Note**: Determines directory structure, layer boundaries, and dependency rules.
- **Maps to**: `{{ architecture }}` + `{{ arch_rules }}`

---

## G3 — UI Framework

### Q4. UI Framework (varies by Q1)
- **For Flutter**: A) Material Design 3 **【Recommended】** — B) Cupertino (iOS-style) — C) Adaptive (auto-switch by platform)
- **For React Native**: A) React Native core components + StyleSheet **【Recommended】** — B) Tamagui / NativeWind — C) Custom design system
- **For iOS**: A) SwiftUI **【Recommended: modern, declarative】** — B) UIKit (programmatic) — C) UIKit + Storyboards
- **For Android**: A) Jetpack Compose **【Recommended: modern, declarative】** — B) XML + Material 3 — C) Hybrid (Compose + Views)
- **Maps to**: `{{ ui_framework }}` + `{{ ui_rules }}`

---

## G4 — Navigation & State

### Q5. Navigation Strategy
- **Options**:
  - A) Platform-default deep linking capable (GoRouter / NavigationStack / Compose Navigation) **【Recommended】**
  - B) URL-based routing with deep linking as first-class citizen
  - C) Simple stack navigation (no deep linking needed)
- **Note**: Determines routing conventions, deep link handling, and navigation testing rules.
- **Maps to**: `{{ navigation }}` + `{{ navigation_rules }}`

### Q6. State Management (varies by Q1)
- **For Flutter**: A) Riverpod **【Recommended】** — B) Bloc — C) Provider — D) GetX
- **For React Native**: A) Zustand **【Recommended】** — B) Redux Toolkit — C) Jotai — D) React Context only
- **For iOS**: A) @Observable / @State (SwiftUI native) **【Recommended】** — B) Combine — C) Manual KVO/NotificationCenter
- **For Android**: A) ViewModel + StateFlow **【Recommended】** — B) MutableState (Compose) — C) LiveData
- **Maps to**: `{{ state_management }}` + `{{ state_rules }}`

---

## G5 — Networking & Data

### Q7. Networking Library (varies by Q1)
- **For Flutter**: A) Dio **【Recommended】** — B) http package — C) Chopper (code-gen)
- **For React Native**: A) Axios **【Recommended】** — B) fetch + TanStack Query — C) React Native built-in fetch
- **For iOS**: A) URLSession + async/await **【Recommended】** — B) Alamofire
- **For Android**: A) Retrofit + OkHttp **【Recommended】** — B) Ktor Client
- **Maps to**: `{{ networking }}` + `{{ networking_rules }}`

### Q8. Local Persistence (varies by Q1)
- **For Flutter**: A) Drift (SQLite, type-safe) **【Recommended】** — B) Hive (KV store) — C) Isar (NoSQL)
- **For React Native**: A) MMKV (KV) + WatermelonDB (relational) **【Recommended】** — B) AsyncStorage + SQLite — C) Realm
- **For iOS**: A) SwiftData **【Recommended】** — B) CoreData — C) GRDB (SQLite)
- **For Android**: A) Room **【Recommended】** — B) DataStore (Preferences/Proto) — C) SQLDelight (multi-platform)
- **Maps to**: `{{ persistence }}` + `{{ persistence_rules }}`

---

## G6 — Platform Features

### Q9. Push Notifications
- **Options**:
  - A) Yes, needed (remote push via FCM/APNs) **【Recommended: production apps】**
  - B) Not required yet
- **Note**: Determines notification channel configuration, token management, and foreground/background handling rules.
- **Maps to**: `{{ push_notifications }}` + `{{ platform_features_rules }}`

### Q10. Background Tasks
- **Options**:
  - A) Yes, needed (data sync, file upload, periodic refresh) **【Recommended: data-heavy apps】**
  - B) Not required
- **Note**: Determines background execution constraints, battery optimization, and platform-specific background mode rules.
- **Maps to**: `{{ background_tasks }}` + `{{ platform_features_rules }}`

### Q11. Permissions Strategy
- **Options**:
  - A) Ask-on-use with rationale dialog **【Recommended: highest acceptance rate】**
  - B) Ask-on-launch (only for critically required permissions)
- **Note**: Determines permission request flow, denied-permission handling, and platform-specific manifest rules.
- **Maps to**: `{{ permissions_strategy }}`

---

## G7 — Testing

### Q12. Test Coverage Requirements
- **Options**:
  - A) Unit tests + Widget/Component tests + Integration tests **【Recommended】**
  - B) Unit tests + Widget/Component tests only
  - C) Critical path integration tests only
  - D) Not required yet
- **Maps to**: `{{ test_coverage }}` + `{{ test_rules }}`

### Q13. Unit Test Framework (only ask if Q12 = A or B; varies by Q1)
- **For Flutter**: A) flutter_test + mocktail **【Recommended】**
- **For React Native**: A) Jest + React Native Testing Library **【Recommended】**
- **For iOS**: A) XCTest + Swift Testing **【Recommended】**
- **For Android**: A) JUnit 5 + MockK **【Recommended】**
- **Maps to**: `{{ unit_test_framework }}`

### Q14. UI/E2E Test Framework (only ask if Q12 = A or C; varies by Q1)
- **For Flutter**: A) flutter_test (widget) + Patrol (integration) **【Recommended】**
- **For React Native**: A) Detox **【Recommended】** — B) Maestro
- **For iOS**: A) XCUITest **【Recommended】**
- **For Android**: A) Compose Test + Espresso **【Recommended】**
- **Maps to**: `{{ e2e_framework }}`

---

## G8 — App Distribution

### Q15. Distribution Method
- **Options**:
  - A) App Store (TestFlight) + Google Play (Internal Testing) **【Recommended】**
  - B) Enterprise / internal distribution (MDM / private store)
  - C) Not determined yet (development phase)
- **Note**: Determines code signing, version management, staged rollout, and app review guideline rules.
- **Maps to**: `{{ distribution }}` + `{{ distribution_rules }}`

---

## G9 — Performance & Accessibility

### Q16. Performance Targets
- **Options**:
  - A) 60fps smooth scrolling, < 100MB app download, < 150MB memory **【Recommended】**
  - B) 120fps ProMotion, < 50MB download, < 100MB memory (premium experience)
  - C) Not required yet
- **Note**: Determines frame budget, image optimization, lazy loading, and CI performance gate rules.
- **Maps to**: `{{ performance_target }}` + `{{ performance_rules }}`

### Q17. Accessibility Targets
- **Options**:
  - A) Platform defaults: VoiceOver/TalkBack + Dynamic Type + minimum contrast **【Recommended】**
  - B) WCAG 2.1 AA equivalent + platform a11y + screen reader testing
  - C) Basic only (touch targets + labels)
- **Note**: Determines accessibility audit rules and testing requirements.
- **Maps to**: `{{ a11y_target }}` + `{{ a11y_rules }}`

---

## G10 — AI Constraints

### Q18. AI Permission to Add Dependencies
- **Options**:
  - A) Forbid AI from modifying dependency manifests on its own; human review required **【Recommended】**
  - B) Allowed, but must declare in PR description with alternative comparison
  - C) Fully allowed
- **Maps to**: `{{ ai_dependency_rule }}`

### Q19. AI Impact Analysis Before Modifying Shared Code
- **Options**:
  - A) Must list all callers and assess platform impact first **【Recommended】**
  - B) Not required
- **Maps to**: `{{ ai_breaking_change_rule }}`

### Q20. AI Platform-Specific Code Generation
- **Options**:
  - A) Must not mix platform paradigms without explicit justification (iOS patterns in Android code, Flutter widgets used like Android Views) **【Recommended】**
  - B) Flexible, as long as it compiles
- **Maps to**: `{{ ai_platform_rule }}`
