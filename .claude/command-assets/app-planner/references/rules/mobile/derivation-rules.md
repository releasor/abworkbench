# Derivation Rules — Mobile Auto-Derivation Rule Mapping

> This file defines the mapping "Phase 2 answers → rule blocks auto-injected into mobile-rules.md". The AI reads this file in Phase 3 — **do not ask the user again**.

---

## Phase 2 Answer Direct-Fill Table (copy user answer text directly into placeholders)

| Template Placeholder | Source | Example Fill |
|---------------------|--------|-------------|
| `{{ project_name }}` | Phase 0 auto-read | `my-mobile-app` |
| `{{ generated_at }}` | Phase 4, AI writes current date | `2026-05-24` |
| `{{ platform }}` | Q1 answer | `Flutter (Dart)` |
| `{{ min_os_version }}` | Q2 answer | `iOS 17+ / Android 14+` |
| `{{ architecture }}` | Q3 answer | `MVVM` |
| `{{ ui_framework }}` | Q4 answer | `Material Design 3` |
| `{{ navigation }}` | Q5 answer | `GoRouter` |
| `{{ state_management }}` | Q6 answer | `Riverpod` |
| `{{ networking }}` | Q7 answer | `Dio` |
| `{{ persistence }}` | Q8 answer | `Drift` |
| `{{ push_notifications }}` | Q9 answer | `FCM/APNs` |
| `{{ background_tasks }}` | Q10 answer | `WorkManager/BGTaskScheduler` |
| `{{ permissions_strategy }}` | Q11 answer | `Ask-on-use` |
| `{{ test_coverage }}` | Q12 answer | `Unit + Widget + Integration` |
| `{{ unit_test_framework }}` | Q13 answer | `flutter_test + mocktail` |
| `{{ e2e_framework }}` | Q14 answer | `Patrol` |
| `{{ distribution }}` | Q15 answer | `App Store + Google Play` |
| `{{ performance_target }}` | Q16 answer | `60fps, < 100MB` |
| `{{ a11y_target }}` | Q17 answer | `Platform defaults` |

---

## Trigger Map

**Coverage policy**: 【Recommended】options always have trigger entries with rule blocks. Non-recommended options may or may not have triggers. If a user selects a non-recommended option with no matching trigger, the corresponding rule placeholder is intentionally left empty — the TL;DR table still records the user's choice, but no pre-authored derived rules exist for that option. The AI may suggest the user switch to the recommended option for better rule coverage.

**Q13/Q14 note**: Q13 and Q14 are direct-fill only (no derivation rule blocks). The TL;DR table documents the chosen frameworks. Detailed framework-specific rules are not auto-generated — the AI should apply the framework's official best practices.

| Trigger (Phase 2 Answer) | Inject Rule Block ID | Inject Into Placeholder |
|--------------------------|---------------------|------------------------|
| Q1 = Flutter | `D-FLUTTER-01`, `D-FLUTTER-02` | `{{ tech_stack_rules }}` |
| Q1 = React Native | `D-RN-01`, `D-RN-02` | `{{ tech_stack_rules }}` |
| Q1 = iOS native | `D-IOS-01`, `D-IOS-02` | `{{ tech_stack_rules }}` |
| Q1 = Android native | `D-ANDROID-01`, `D-ANDROID-02` | `{{ tech_stack_rules }}` |
| Q1 = Both native | `D-BOTH-NATIVE-01` | `{{ tech_stack_rules }}` |
| Q2 = Latest - 1 | `D-OS-LATEST-1-01` | `{{ tech_stack_rules }}` |
| Q2 = Latest - 2 | `D-OS-LATEST-2-01` | `{{ tech_stack_rules }}` |
| Q2 = Latest - 3 | `D-OS-LATEST-3-01` | `{{ tech_stack_rules }}` |
| Q3 = MVVM | `D-MVVM-01` | `{{ arch_rules }}` |
| Q3 = Clean Architecture | `D-CLEAN-MOBILE-01` | `{{ arch_rules }}` |
| Q3 = Redux-style / MVI | `D-MVI-01` | `{{ arch_rules }}` |
| Q3 = Simple MVC | `D-MVC-MOBILE-01` | `{{ arch_rules }}` |
| Q4 = Material Design 3 | `D-MATERIAL3-01` | `{{ ui_rules }}` |
| Q4 = Cupertino | `D-CUPERTINO-01` | `{{ ui_rules }}` |
| Q4 = Adaptive | `D-ADAPTIVE-UI-01` | `{{ ui_rules }}` |
| Q4 = RN core + StyleSheet | `D-RN-CORE-01` | `{{ ui_rules }}` |
| Q4 = Tamagui / NativeWind | `D-NATIVEWIND-01` | `{{ ui_rules }}` |
| Q4 = SwiftUI | `D-SWIFTUI-01` | `{{ ui_rules }}` |
| Q4 = UIKit | `D-UIKIT-01` | `{{ ui_rules }}` |
| Q4 = Jetpack Compose | `D-COMPOSE-01` | `{{ ui_rules }}` |
| Q4 = XML + Material 3 | `D-XML-MATERIAL-01` | `{{ ui_rules }}` |
| Q5 = Platform-default | `D-DEEP-LINK-01` | `{{ navigation_rules }}` |
| Q5 = URL-based routing | `D-URL-ROUTING-01` | `{{ navigation_rules }}` |
| Q5 = Simple stack | `D-STACK-NAV-01` | `{{ navigation_rules }}` |
| Q6 = Riverpod | `D-RIVERPOD-01` | `{{ state_rules }}` |
| Q6 = Bloc | `D-BLOC-01` | `{{ state_rules }}` |
| Q6 = Provider | `D-PROVIDER-01` | `{{ state_rules }}` |
| Q6 = GetX | `D-GETX-01` | `{{ state_rules }}` |
| Q6 = Zustand | `D-ZUSTAND-MOBILE-01` | `{{ state_rules }}` |
| Q6 = Redux Toolkit | `D-REDUX-MOBILE-01` | `{{ state_rules }}` |
| Q6 = @Observable / @State | `D-SWIFT-STATE-01` | `{{ state_rules }}` |
| Q6 = Combine | `D-COMBINE-01` | `{{ state_rules }}` |
| Q6 = ViewModel + StateFlow | `D-VIEWMODEL-STATE-01` | `{{ state_rules }}` |
| Q6 = MutableState | `D-MUTABLESTATE-01` | `{{ state_rules }}` |
| Q7 = Dio | `D-DIO-01` | `{{ networking_rules }}` |
| Q7 = Axios | `D-AXIOS-MOBILE-01` | `{{ networking_rules }}` |
| Q7 = URLSession + async/await | `D-URLSESSION-01` | `{{ networking_rules }}` |
| Q7 = Retrofit + OkHttp | `D-RETROFIT-01` | `{{ networking_rules }}` |
| Q8 = Drift | `D-DRIFT-01` | `{{ persistence_rules }}` |
| Q8 = Hive | `D-HIVE-01` | `{{ persistence_rules }}` |
| Q8 = MMKV + WatermelonDB | `D-MMKV-01` | `{{ persistence_rules }}` |
| Q8 = SwiftData | `D-SWIFTDATA-01` | `{{ persistence_rules }}` |
| Q8 = CoreData | `D-COREDATA-01` | `{{ persistence_rules }}` |
| Q8 = Room | `D-ROOM-01` | `{{ persistence_rules }}` |
| Q8 = DataStore | `D-DATASTORE-01` | `{{ persistence_rules }}` |
| Q9 = Yes, needed | `D-PUSH-01` | `{{ platform_features_rules }}` |
| Q10 = Yes, needed | `D-BG-TASK-01` | `{{ platform_features_rules }}` |
| Q11 = Ask-on-use | `D-PERM-ASK-ON-USE-01` | `{{ platform_features_rules }}` |
| Q11 = Ask-on-launch | `D-PERM-ASK-LAUNCH-01` | `{{ platform_features_rules }}` |
| Q12 = All tiers | `D-MOBILE-TEST-01` | `{{ test_rules }}` |
| Q12 = Unit + Widget only | `D-MOBILE-TEST-02` | `{{ test_rules }}` |
| Q12 = Critical path only | `D-MOBILE-TEST-03` | `{{ test_rules }}` |
| Q15 = App Store + Google Play | `D-APP-STORE-01` | `{{ distribution_rules }}` |
| Q15 = Enterprise distribution | `D-ENTERPRISE-DIST-01` | `{{ distribution_rules }}` |
| Q16 = 60fps | `D-PERF-60FPS-01` | `{{ performance_rules }}` |
| Q16 = 120fps premium | `D-PERF-120FPS-01` | `{{ performance_rules }}` |
| Q17 = Platform defaults | `D-A11Y-PLATFORM-01` | `{{ a11y_rules }}` |
| Q17 = WCAG 2.1 AA equivalent | `D-A11Y-WCAG-01` | `{{ a11y_rules }}` |
| Q18 = Forbid | `D-AI-DEP-STRICT-MOBILE-01` | `{{ ai_dependency_rule }}` |
| Q18 = Allowed with declaration | `D-AI-DEP-ANNOUNCE-MOBILE-01` | `{{ ai_dependency_rule }}` |
| Q19 = Must list callers | `D-AI-BREAK-STRICT-MOBILE-01` | `{{ ai_breaking_change_rule }}` |
| Q20 = Must not mix paradigms | `D-AI-PLATFORM-STRICT-01` | `{{ ai_platform_rule }}` |

**Matching rule**: The AI should use substring match against the user's selected option text. The trigger text in the left column is a key phrase; the AI should check if all significant words in the trigger appear in the selected option text (keyword matching), not literal substring matching.

---

## Rule Block Definitions

### D-FLUTTER-01
**Trigger**: Q1 = Flutter | **Inject into**: `{{ tech_stack_rules }}`

- Flutter SDK stable channel. `pubspec.yaml` locks dependency versions with caret constraints.
- Dart analysis: `flutter analyze` must pass with zero errors in CI. Use `dart fix --apply` for auto-fixes.
- Widget tree: prefer composition over inheritance. Forbid creating custom widget subclasses when composition works.
- `const` constructors everywhere possible (improves rebuild performance). CI should warn on missing `const`.
- StatefulWidget only when state is needed. Default to StatelessWidget.

### D-FLUTTER-02
**Trigger**: Q1 = Flutter | **Inject into**: `{{ tech_stack_rules }}`

- Project structure: `lib/features/<domain>/` with `screens/`, `widgets/`, `models/`, `services/`.
- Assets declared in `pubspec.yaml` under `flutter: assets:`. Forbid hardcoded asset paths in code (use an `Assets` class or code-gen).
- Use `flutter_lints` or `very_good_analysis` for lint rules. Forbid disabling lint rules without a comment explaining why.
- Platform channels: isolate in a single `platform/` service layer. Forbid scattering `MethodChannel` calls across widgets.

### D-RN-01
**Trigger**: Q1 = React Native | **Inject into**: `{{ tech_stack_rules }}`

- React Native with TypeScript strict mode. Forbid `any` in new code.
- Use Hermes JS engine (default in RN 0.70+). Test with Hermes enabled.
- Platform-specific code: use `Platform.OS` checks or `.ios.ts` / `.android.ts` file extensions. Forbid platform-specific imports leaking into shared code.
- Metro bundler config: commit `metro.config.js`. Custom resolvers documented.

### D-RN-02
**Trigger**: Q1 = React Native | **Inject into**: `{{ tech_stack_rules }}`

- Project structure: `src/features/<domain>/` with `screens/`, `components/`, `hooks/`, `api/`.
- Native modules: wrap in a thin TypeScript adapter. Forbid using native module APIs directly in screens.
- Use `react-native-mmkv` for fast KV storage over AsyncStorage for performance-critical data.

### D-IOS-01
**Trigger**: Q1 = iOS native | **Inject into**: `{{ tech_stack_rules }}`

- Swift 5.9+. Use Swift Concurrency (`async/await`) for all async work. Forbid completion-handler-based APIs for new code.
- Swift Package Manager for dependencies. Forbid Carthage. CocoaPods allowed only for legacy deps without SPM support.
- All public API must have documentation comments (`///`). CI validates with `swift-docc-plugin`.
- `swiftlint` must pass with zero errors. Config committed to repo root.

### D-IOS-02
**Trigger**: Q1 = iOS native | **Inject into**: `{{ tech_stack_rules }}`

- Xcode project settings managed via `.xcconfig` files. Forbid hardcoding build settings in the project file.
- Version and build number managed by CI. Forbid manual increment.
- App delegate/scene delegate minimal. Use feature-based app initialization.

### D-ANDROID-01
**Trigger**: Q1 = Android native | **Inject into**: `{{ tech_stack_rules }}`

- Kotlin 2.0+. Use Kotlin Coroutines + Flow for async. Forbid raw `Thread` / `AsyncTask` (deprecated).
- Gradle Version Catalog (`libs.versions.toml`) for dependency management. Forbid declaring versions directly in module `build.gradle`.
- `detekt` must pass with zero errors. Config committed to repo root.
- Min SDK, target SDK, compile SDK declared in a single `config.gradle` or convention plugin.

### D-ANDROID-02
**Trigger**: Q1 = Android native | **Inject into**: `{{ tech_stack_rules }}`

- Project structure by feature: `app/src/main/java/<package>/<feature>/` with `ui/`, `data/`, `domain/`.
- Dependency injection via Hilt (recommended) or Koin. Forbid manual DI / service locator in application code.
- ProGuard/R8 rules committed. Add rules for each reflection-using library.

### D-BOTH-NATIVE-01
**Trigger**: Q1 = Both native | **Inject into**: `{{ tech_stack_rules }}`

- Dual native codebases (Swift + Kotlin). iOS rules apply to the Swift codebase. Android rules apply to the Kotlin codebase.
- Shared business logic must be documented in a shared spec — no code-level sharing between the two platforms.
- Each platform follows its own native conventions independently.
- Both platform-specific rule sets (D-IOS-* and D-ANDROID-*) apply to their respective codebases.

### D-OS-LATEST-1-01
**Trigger**: Q2 = Latest - 1 | **Inject into**: `{{ tech_stack_rules }}`

- Target API level: latest stable - 1. minSdk = latest - 3 (or latest - 2 for platforms with faster adoption).
- Forbid using APIs introduced in the latest OS version without `@available` / `@RequiresApi` guards.
- Deprecated APIs in target version must be migrated within one release cycle.

### D-OS-LATEST-2-01
**Trigger**: Q2 = Latest - 2 | **Inject into**: `{{ tech_stack_rules }}`

- Target API level: latest stable - 2. Wider compatibility, more devices covered.
- `@available(iOS 16, *)` / `@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)` for latest APIs.
- Test on oldest supported OS version as part of CI or manual QA checklist.

### D-OS-LATEST-3-01
**Trigger**: Q2 = Latest - 3 | **Inject into**: `{{ tech_stack_rules }}`

- Wide compatibility mode. Must test on oldest supported OS version for every release.
- More `@available` checks needed. Document which features degrade gracefully on older OS versions.

### D-MVVM-01
**Trigger**: Q3 = MVVM | **Inject into**: `{{ arch_rules }}`

- ViewModel exposes UI state as observable streams (StateFlow / @Published / Stream). View observes and renders.
- ViewModel never holds a reference to View/Widget/ViewController. Use unidirectional data flow.
- One ViewModel per screen or major component. Forbid sharing ViewModel instances across unrelated screens.
- Business logic in ViewModel is testable without UI framework imports.

### D-CLEAN-MOBILE-01
**Trigger**: Q3 = Clean Architecture | **Inject into**: `{{ arch_rules }}`

- Layers: Presentation → Domain (UseCase) → Data (Repository) → Data Source.
- Domain layer has zero platform/framework dependencies. Pure Dart/Kotlin/Swift.
- UseCases are single-responsibility. One UseCase = one business operation.
- Repository interfaces in Domain layer. Implementations in Data layer.

### D-MVI-01
**Trigger**: Q3 = Redux-style / MVI | **Inject into**: `{{ arch_rules }}`

- Unidirectional data flow: Intent (user action) → Model (state mutation) → View (render).
- State is a single immutable object per screen. Mutations produce new state (never modify in-place).
- Side effects (network, DB) handled by middleware or dedicated effect handlers. Forbid side effects in reducers/mutation functions.

### D-MVC-MOBILE-01
**Trigger**: Q3 = Simple MVC | **Inject into**: `{{ arch_rules }}`

- Simplified pattern for small apps (< 5 screens). Model holds data + business logic. Controller mediates. View renders.
- Forbid using MVC for projects expected to grow beyond 10 screens. Re-evaluate architecture before scaling.

### D-MATERIAL3-01
**Trigger**: Q4 = Material Design 3 | **Inject into**: `{{ ui_rules }}`

- Use Material 3 design tokens: `MaterialTheme.colorScheme`, `MaterialTheme.typography`.
- Dynamic color (Material You) on Android 12+. Opt-in via `DynamicColorBuilder`.
- Theme configured via `ThemeData` using `ColorScheme.fromSeed()`. Forbid hardcoding colors outside theme.
- Component spacing follows Material 3 8dp grid.

### D-CUPERTINO-01
**Trigger**: Q4 = Cupertino | **Inject into**: `{{ ui_rules }}`

- Use `CupertinoApp` + `CupertinoPageScaffold`. iOS-native look and feel throughout.
- Navigation uses `CupertinoPageRoute`. Forbid mixing with Material PageRoute for consistency.
- Cupertino widgets for forms, dialogs, and action sheets. Use `cupertino_icons` package.

### D-ADAPTIVE-UI-01
**Trigger**: Q4 = Adaptive | **Inject into**: `{{ ui_rules }}`

- Platform-adaptive UI: `Platform.isIOS` → Cupertino, `Platform.isAndroid` → Material 3.
- Shared business logic. UI switches at the widget tree leaves, not at the app root.
- `adaptive_theme` or custom platform check helper. Forbid importing platform-specific widget libraries in shared code.

### D-RN-CORE-01
**Trigger**: Q4 = RN core + StyleSheet | **Inject into**: `{{ ui_rules }}`

- Use React Native core components (View, Text, ScrollView, FlatList, TextInput). Forbid unnecessary UI libraries.
- StyleSheet.create() for all styles. Forbid inline style objects (causes re-render churn).
- Design tokens in `src/theme/tokens.ts`. All components reference tokens via `useTheme()` or import.

### D-NATIVEWIND-01
**Trigger**: Q4 = Tamagui / NativeWind | **Inject into**: `{{ ui_rules }}`

- Use Tamagui or NativeWind as the UI foundation. Forbid mixing with raw StyleSheet.
- Design tokens in `tamagui.config.ts` or `tailwind.config.js`. Theme centralized.
- Optimizing compiler (Tamagui) or Tailwind JIT must be configured for production builds.

### D-SWIFTUI-01
**Trigger**: Q4 = SwiftUI | **Inject into**: `{{ ui_rules }}`

- SwiftUI with `@Observable` macro (iOS 17+) or `@StateObject` / `@ObservedObject` (iOS 16-).
- View structs lean — extract subviews when body exceeds ~20 lines.
- Use `NavigationStack` (iOS 16+). Forbid `NavigationView` (deprecated).
- Preview providers for all screens. Forbid relying on simulator-only iteration.

### D-UIKIT-01
**Trigger**: Q4 = UIKit | **Inject into**: `{{ ui_rules }}`

- UIKit with programmatic Auto Layout (NSLayoutConstraint or SnapKit). Forbid Storyboards for new screens.
- View code separated from ViewController: use UIView subclasses for rendering, ViewController for lifecycle + coordination.
- Use `UICollectionView` with `UICollectionViewDiffableDataSource` for lists. Forbid `UITableView` for new code.

### D-COMPOSE-01
**Trigger**: Q4 = Jetpack Compose | **Inject into**: `{{ ui_rules }}`

- Jetpack Compose with Material 3. `setContent {}` as single entry point.
- State hoisting: state flows down, events flow up. Forbid Compose `remember` as global state substitute.
- Preview annotations (`@Preview`) with multiple configurations (light/dark, font scales).
- Use `Modifier` chaining. Forbid custom drawing when a Modifier exists.

### D-XML-MATERIAL-01
**Trigger**: Q4 = XML + Material 3 | **Inject into**: `{{ ui_rules }}`

- XML layouts with Material 3 theme via `MaterialComponents` theme parent.
- Data Binding or ViewBinding for view references. Forbid `findViewById`.
- `ConstraintLayout` as the default layout. Forbid deeply nested `LinearLayout` chains.

### D-DEEP-LINK-01
**Trigger**: Q5 = Platform-default | **Inject into**: `{{ navigation_rules }}`

- Navigation uses platform defaults with deep linking support:
  - Flutter: GoRouter with `ShellRoute` for tab-based navigation.
  - React Native: React Navigation with linking config.
  - iOS: NavigationStack with `navigationDestination(for:)`.
  - Android: Compose Navigation with NavDeepLink.
- Every screen must have a unique route path. Forbid ambiguous routes.

### D-URL-ROUTING-01
**Trigger**: Q5 = URL-based routing | **Inject into**: `{{ navigation_rules }}`

- URL-based routing as first-class citizen. Every screen has a canonical URL pattern.
- Deep link URLs resolve to the same screen as in-app navigation.
- Route patterns documented in a centralized `routes.dart` / `routes.ts` / `Routes.swift` file.

### D-STACK-NAV-01
**Trigger**: Q5 = Simple stack | **Inject into**: `{{ navigation_rules }}`

- Simple push/pop stack navigation. No deep linking.
- Forbid programmatic navigation to arbitrary stack positions (push-only from current top).
- Suitable for prototype/simple apps. Plan deep linking migration path for production.

### D-RIVERPOD-01
**Trigger**: Q6 = Riverpod | **Inject into**: `{{ state_rules }}`

- State via Riverpod providers. `StateNotifierProvider` for complex state, `Provider` for derived/computed.
- Providers auto-disposed when no longer listened to (default behavior). Forbid manual dispose.
- Provider dependencies explicit. Forbid using `ref.read` inside build methods (use `ref.watch`).
- Testing: override providers in test with `ProviderScope.overrides`.

### D-BLOC-01
**Trigger**: Q6 = Bloc | **Inject into**: `{{ state_rules }}`

- Bloc pattern: Event → Bloc → State. Events and States are sealed classes (or freezed unions).
- Bloc-to-Bloc communication via stream subscription in the presentation layer, not direct Bloc references.
- `BlocProvider` provides Bloc to widget subtree. Forbid creating Bloc instances directly in widgets.
- Testing: `blocTest` for unit-testing Bloc logic. Mock Blocs for widget tests.

### D-PROVIDER-01
**Trigger**: Q6 = Provider | **Inject into**: `{{ state_rules }}`

- Provider pattern: `ChangeNotifierProvider` for mutable state, `Provider` for immutable/reactive values.
- Use `context.watch<T>()` in build, `context.read<T>()` in callbacks. Forbid `context.read` in build methods.
- For complex state (> 5 properties), prefer Riverpod or Bloc. Provider is designed for medium-complexity state.

### D-GETX-01
**Trigger**: Q6 = GetX | **Inject into**: `{{ state_rules }}`

- GetX for state management + navigation + DI. Verify that all three features are needed before choosing GetX.
- `GetBuilder` for reactive UI. Forbid mixing GetX reactive state with other state management solutions.
- Warning: GetX is opinionated and couples navigation, state, and DI. Migration away from GetX is expensive. Document this decision.

### D-ZUSTAND-MOBILE-01
**Trigger**: Q6 = Zustand | **Inject into**: `{{ state_rules }}`

- Zustand stores: one per domain. Forbid massive global store.
- Store selectors prevent unnecessary re-renders: `useStore(state => state.specificField)`.
- Async actions in store via `set`. Forbid calling `set` outside of store actions.
- Persist middleware for session state: `zustand/middleware persist` with MMKV storage adapter.

### D-REDUX-MOBILE-01
**Trigger**: Q6 = Redux Toolkit | **Inject into**: `{{ state_rules }}`

- Redux Toolkit with `createSlice` + `createAsyncThunk`.
- Middleware: `redux-persist` with MMKV storage engine for session persistence.
- Forbid dispatching actions directly from components — use typed hooks (`useAppDispatch`, `useAppSelector`).

### D-SWIFT-STATE-01
**Trigger**: Q6 = @Observable / @State | **Inject into**: `{{ state_rules }}`

- SwiftUI native state: `@State` for local UI state, `@Observable` (Observation framework) for shared model data.
- `@Environment` for dependency injection and theme. Forbid creating singletons for DI purposes — use Environment instead.
- `@Bindable` for two-way binding to Observable properties. Forbid hand-rolled KVO.

### D-COMBINE-01
**Trigger**: Q6 = Combine | **Inject into**: `{{ state_rules }}`

- Combine publishers for reactive data streams. `@Published` for observable properties.
- `AnyCancellable` stored in a `Set<AnyCancellable>` for automatic cancellation on deinit.
- Forbid `.sink` without storing the cancellable (memory leak). Use `.store(in: &cancellables)`.

### D-VIEWMODEL-STATE-01
**Trigger**: Q6 = ViewModel + StateFlow | **Inject into**: `{{ state_rules }}`

- ViewModel exposes `StateFlow<UiState>` (single sealed class per screen). View collects with `collectAsStateWithLifecycle()`.
- ViewModel scoped to navigation destination. Forbid ViewModels that outlive their screen.
- ViewModelFactory provided via Hilt or manual DI. Forbid instantiating ViewModels with `ViewModelProvider` directly in Activities.

### D-MUTABLESTATE-01
**Trigger**: Q6 = MutableState | **Inject into**: `{{ state_rules }}`

- Compose `mutableStateOf` + `remember` for local UI state. Forbid as global state container.
- For cross-screen state, use ViewModel + StateFlow, not hoisted `mutableStateOf` at the Activity level.

### D-DIO-01
**Trigger**: Q7 = Dio | **Inject into**: `{{ networking_rules }}`

- Dio instance singleton configured with base URL, interceptors, timeout (connect: 10s, receive: 30s).
- Interceptors: auth token injection, refresh token retry, logging (debug only).
- Response typed via `dio.withJson<T>()` or manual `fromJson` factories. Forbid `dynamic` response types.
- Certificate pinning via `HttpClientAdapter` with custom `SecurityContext` for release builds.

### D-AXIOS-MOBILE-01
**Trigger**: Q7 = Axios | **Inject into**: `{{ networking_rules }}`

- Axios instance with base URL, interceptors, timeout (30s default).
- Request interceptor: attach auth token. Response interceptor: handle 401 refresh, global error normalization.
- API functions in `src/api/` return typed Promise. Forbid `axios.get<any>(...)`.

### D-URLSESSION-01
**Trigger**: Q7 = URLSession + async/await | **Inject into**: `{{ networking_rules }}`

- The default URLSession shared instance for simple requests. Custom `URLSession` with `URLSessionConfiguration.default` + custom headers for API.
- Async/await: `let (data, response) = try await session.data(for: request)`. Forbid completion handler style.
- Response decoding via `JSONDecoder` with `keyDecodingStrategy = .convertFromSnakeCase`.
- Unified API service protocol. Mock implementation for tests and SwiftUI previews.

### D-RETROFIT-01
**Trigger**: Q7 = Retrofit + OkHttp | **Inject into**: `{{ networking_rules }}`

- Retrofit interfaces with `suspend` functions returning `Response<T>` or `Result<T>`.
- OkHttp client singleton with interceptors: auth token, logging (debug), caching.
- Moshi or kotlinx.serialization for JSON. Forbid Gson (unmaintained, slower).
- Timeout: connect 10s, read 30s, write 30s.

### D-DRIFT-01
**Trigger**: Q8 = Drift | **Inject into**: `{{ persistence_rules }}`

- Drift (SQLite, type-safe). Table definitions via Dart classes extending `Table`.
- DAO (Data Access Object) classes for query logic. Forbid raw SQL in widgets/services.
- Migration strategy: `onUpgrade` with versioned migration callbacks. Test migrations.
- Database singleton provided via Riverpod/Provider. Forbid opening database directly.

### D-HIVE-01
**Trigger**: Q8 = Hive | **Inject into**: `{{ persistence_rules }}`

- Hive for KV storage (settings, cache). Forbid using Hive for relational data.
- TypeAdapters registered at app startup. Forbid writing untyped data (`Hive.box('x').put('k', someDynamic)`).
- Boxes opened once at app start, closed on app teardown. Forbid opening/closing boxes per widget build.

### D-MMKV-01
**Trigger**: Q8 = MMKV + WatermelonDB | **Inject into**: `{{ persistence_rules }}`

- MMKV for fast KV (tokens, settings, cache). WatermelonDB for relational data with lazy loading.
- WatermelonDB: `@text`, `@date`, `@children`, `@relation` decorators for schema definition.
- Database version managed via `schemaMigrations`. Forbid destructive migrations without backup.

### D-SWIFTDATA-01
**Trigger**: Q8 = SwiftData | **Inject into**: `{{ persistence_rules }}`

- SwiftData with `@Model` macro. `.modelContainer` in WindowGroup or root view.
- `@Query` for reactive fetch in SwiftUI views. Forbid manual fetch requests in view code.
- Migration via `SchemaMigrationPlan` versions. Test migration from previous model version.

### D-COREDATA-01
**Trigger**: Q8 = CoreData | **Inject into**: `{{ persistence_rules }}`

- CoreData with `NSPersistentContainer`. Background contexts for writes, view context for reads only.
- Forbid `viewContext.perform {}` for writes. Use `container.performBackgroundTask {}` for all mutations.
- Model versioning: add new model version for schema changes. Mapping model for lightweight migration.

### D-ROOM-01
**Trigger**: Q8 = Room | **Inject into**: `{{ persistence_rules }}`

- Room with `@Entity`, `@Dao`, `@Database`. TypeConverters for custom types.
- DAO methods: `suspend` for writes, `Flow<List<T>>` for observable reads.
- Migration via `Migration(x, y) { ... }` with SQL strategies. Test migrations with `MigrationTestHelper`.
- Database singleton via Hilt `@Singleton`. Forbid multiple database instances.

### D-DATASTORE-01
**Trigger**: Q8 = DataStore | **Inject into**: `{{ persistence_rules }}`

- Preferences DataStore (KV) for settings. Proto DataStore for typed structured data.
- `Flow`-based reads. Forbid using `runBlocking` with DataStore reads on the main thread.
- DataStore file migration from SharedPreferences must be tested.

### D-PUSH-01
**Trigger**: Q9 = Yes, needed | **Inject into**: `{{ platform_features_rules }}`

- Push via FCM (Android) / APNs (iOS). Use a cross-platform wrapper (firebase_messaging / @react-native-firebase/messaging) for cross-platform projects.
- Notification channels (Android 8+): one channel per notification category with clear user-facing name.
- Token management: store token on server, retry on failure, invalidate on logout.
- Foreground notification display configurable. Forbid showing sensitive data in notification body.

### D-BG-TASK-01
**Trigger**: Q10 = Yes, needed | **Inject into**: `{{ platform_features_rules }}`

- Flutter: `workmanager` plugin. React Native: `react-native-background-fetch`.
- iOS: BGAppRefreshTask (short) or BGProcessingTask (long). Android: WorkManager with constraints (network, charging).
- Background task ID registered in Info.plist (iOS) and AndroidManifest.xml.
- Forbid running UI updates from background tasks. Persist results, update UI on next foreground.

### D-PERM-ASK-ON-USE-01
**Trigger**: Q11 = Ask-on-use | **Inject into**: `{{ platform_features_rules }}`

- Request permission at the moment of first use, preceded by a rationale dialog (optional but recommended).
- Handle "Don't ask again": detect permanent denial, show Settings redirect dialog with clear benefit statement.
- Permission status checked via platform API before attempting the protected operation. Forbid assuming permission is granted.

### D-PERM-ASK-LAUNCH-01
**Trigger**: Q11 = Ask-on-launch | **Inject into**: `{{ platform_features_rules }}`

- Critical permissions only requested at launch. Must include a clear onboarding explanation BEFORE the system dialog.
- Forbid requesting non-critical permissions at launch. This reduces acceptance rate for all permissions.

### D-MOBILE-TEST-01
**Trigger**: Q12 = All tiers | **Inject into**: `{{ test_rules }}`

- Three-tier testing: unit (ViewModel/Bloc/UseCase), widget/component (individual UI), integration (critical flows).
- Unit test coverage: ViewModel/Bloc layer ≥ 80%. Widget/component tests for shared components ≥ 60%.
- Integration tests cover: login, registration, core CRUD, payment (if applicable).

### D-MOBILE-TEST-02
**Trigger**: Q12 = Unit + Widget | **Inject into**: `{{ test_rules }}`

- Unit tests + widget/component tests. No integration/E2E tests.
- Coverage: ViewModel/Bloc layer ≥ 80%. Shared widgets ≥ 60%.
- Recommend adding integration tests for critical flows before production.

### D-MOBILE-TEST-03
**Trigger**: Q12 = Critical path only | **Inject into**: `{{ test_rules }}`

- Integration tests for critical flows only (login, core CRUD, payment).
- No coverage thresholds enforced project-wide. Critical paths must have ≥ 1 test each.

### D-APP-STORE-01
**Trigger**: Q15 = App Store + Google Play | **Inject into**: `{{ distribution_rules }}`

- iOS: archive via Xcode Cloud or Fastlane. Upload to App Store Connect via `deliver` or Xcode.
- Android: signed app bundle via `./gradlew bundleRelease`. Upload to Google Play Console.
- Staged rollout default: 10% → 50% → 100% over 48 hours. Monitor crash-free rate at each stage.
- Code signing: iOS uses automatic signing (Xcode managed). Android uses `signingConfigs` in Gradle with keystore in CI secrets.

### D-ENTERPRISE-DIST-01
**Trigger**: Q15 = Enterprise distribution | **Inject into**: `{{ distribution_rules }}`

- iOS: enterprise certificate + provisioning profile. OTA distribution via HTTPS server with manifest.plist.
- Android: signed APK distributed via private channel or MDM.
- No App Store Review process. Internal compliance review replaces it. Document compliance criteria.

### D-PERF-60FPS-01
**Trigger**: Q16 = 60fps | **Inject into**: `{{ performance_rules }}`

- Frame budget: 16ms/frame. Profile with Flutter DevTools / Android Studio Profiler / Xcode Instruments.
- App download < 100MB. Use app bundle / app thinning. Defer large assets to on-demand download.
- Memory budget: < 150MB on most devices. Monitor with memory profiler. Release cached images on memory warning.
- List/scroll performance: use `ListView.builder` / `LazyColumn` / `FlatList` with `getItemLayout`.

### D-PERF-120FPS-01
**Trigger**: Q16 = 120fps premium | **Inject into**: `{{ performance_rules }}`

- On top of 60fps rules: frame budget 8ms/frame. Profile on ProMotion (iOS) / 120Hz (Android) devices.
- App download < 50MB. Aggressive asset compression. AVIF/WebP images. SVG over PNG.
- Memory budget: < 100MB. Aggressive cache eviction. Lazy widget/component instantiation.
- Shader precompilation (Flutter). Warm-up complex Compose functions.

### D-A11Y-PLATFORM-01
**Trigger**: Q17 = Platform defaults | **Inject into**: `{{ a11y_rules }}`

- iOS: VoiceOver support for all interactive elements via `.accessibilityLabel()`, `.accessibilityHint()`.
- Android: TalkBack support via `contentDescription`, `semantics {}` modifier (Compose).
- Dynamic Type: support up to 2x font scaling without layout breakage.
- Minimum touch target: 44x44pt (iOS), 48x48dp (Android).

### D-A11Y-WCAG-01
**Trigger**: Q17 = WCAG 2.1 AA | **Inject into**: `{{ a11y_rules }}`

- On top of platform defaults: WCAG 2.1 AA contrast (4.5:1 normal, 3:1 large text).
- Screen reader audit: every screen navigable end-to-end with VoiceOver/TalkBack.
- Focus order: logical and predictable. Group related content with accessibility containers.
- Accessibility testing in CI: `accessibility_scanner` (Flutter), Accessibility Inspector (iOS), Accessibility Scanner (Android).

### D-AI-DEP-STRICT-MOBILE-01
**Trigger**: Q18 = Forbid | **Inject into**: `{{ ai_dependency_rule }}`

- AI must not modify `pubspec.yaml` / `package.json` / `Podfile` / `build.gradle` on its own.
- If a new dependency is needed, AI must list: package name, version, reason, alternative comparison, platform support matrix, and bundle size impact. Human reviews before adding.

### D-AI-DEP-ANNOUNCE-MOBILE-01
**Trigger**: Q18 = Allowed with declaration | **Inject into**: `{{ ai_dependency_rule }}`

- AI may introduce new dependencies, but must declare: package name, version, reason, and platform compatibility in the PR description.
- Forbid adding dependencies that support only one platform in a cross-platform project without explicit justification.

### D-AI-BREAK-STRICT-MOBILE-01
**Trigger**: Q19 = Must list callers | **Inject into**: `{{ ai_breaking_change_rule }}`

- Before modifying a shared widget/component/utility/service, AI must list all callers and assess impact on: iOS behavior, Android behavior, navigation flow, state management integrity.
- Breaking changes must be prefixed with `[BREAKING]` and include a migration guide covering all target platforms.

### D-AI-PLATFORM-STRICT-01
**Trigger**: Q20 = Must not mix paradigms | **Inject into**: `{{ ai_platform_rule }}`

- AI must not write iOS architecture patterns in Android code or vice versa.
- Flutter code must follow Flutter conventions (widget composition), not Android (Fragment/Activity) or iOS (ViewController) patterns.
- Cross-platform code must not contain platform-specific workarounds without a `// Platform: <reason>` comment.
- If a change introduces a pattern that is idiomatic on one platform but foreign on another, AI must flag it explicitly.

---

## Template Placeholder Coverage Self-Check

| Placeholder | Fill Source | Source Type |
|------------|-------------|-------------|
| `{{ project_name }}` | Phase 0 auto-read | Metadata |
| `{{ generated_at }}` | Phase 4 | Metadata |
| `{{ platform }}` | Q1 answer | Direct fill |
| `{{ min_os_version }}` | Q2 answer | Direct fill |
| `{{ architecture }}` | Q3 answer | Direct fill |
| `{{ ui_framework }}` | Q4 answer | Direct fill |
| `{{ navigation }}` | Q5 answer | Direct fill |
| `{{ state_management }}` | Q6 answer | Direct fill |
| `{{ networking }}` | Q7 answer | Direct fill |
| `{{ persistence }}` | Q8 answer | Direct fill |
| `{{ push_notifications }}` | Q9 answer | Direct fill |
| `{{ background_tasks }}` | Q10 answer | Direct fill |
| `{{ permissions_strategy }}` | Q11 answer | Direct fill |
| `{{ test_coverage }}` | Q12 answer | Direct fill |
| `{{ unit_test_framework }}` | Q13 answer (If Q12 not in (A, B) → fill with '*Not required at this stage*') | Direct fill |
| `{{ e2e_framework }}` | Q14 answer (If Q12 not in (A, C) → fill with '*Not required at this stage*') | Direct fill |
| `{{ distribution }}` | Q15 answer | Direct fill |
| `{{ performance_target }}` | Q16 answer | Direct fill |
| `{{ a11y_target }}` | Q17 answer | Direct fill |
| `{{ tech_stack_rules }}` | D-FLUTTER/RN/IOS/ANDROID + D-OS-LATEST | Derivation |
| `{{ arch_rules }}` | D-MVVM/D-CLEAN-MOBILE/D-MVI/D-MVC-MOBILE | Derivation |
| `{{ ui_rules }}` | D-MATERIAL3/CUPERTINO/ADAPTIVE/RN-CORE/NATIVEWIND/SWIFTUI/UIKIT/COMPOSE/XML-MATERIAL | Derivation |
| `{{ navigation_rules }}` | D-DEEP-LINK/D-URL-ROUTING/D-STACK-NAV | Derivation |
| `{{ state_rules }}` | D-RIVERPOD/BLOC/PROVIDER/GETX/ZUSTAND-MOBILE/REDUX-MOBILE/SWIFT-STATE/COMBINE/VIEWMODEL-STATE/MUTABLESTATE | Derivation |
| `{{ networking_rules }}` | D-DIO/AXIOS-MOBILE/URLSESSION/RETROFIT | Derivation |
| `{{ persistence_rules }}` | D-DRIFT/HIVE/MMKV/SWIFTDATA/COREDATA/ROOM/DATASTORE | Derivation |
| `{{ platform_features_rules }}` | D-PUSH/D-BG-TASK/D-PERM | Derivation |
| `{{ test_rules }}` | D-MOBILE-TEST-01/02/03 | Derivation |
| `{{ distribution_rules }}` | D-APP-STORE/D-ENTERPRISE-DIST | Derivation |
| `{{ performance_rules }}` | D-PERF-60FPS/D-PERF-120FPS | Derivation |
| `{{ a11y_rules }}` | D-A11Y-PLATFORM/D-A11Y-WCAG | Derivation |
| `{{ ai_dependency_rule }}` | D-AI-DEP-STRICT/ANNOUNCE-MOBILE | Derivation |
| `{{ ai_breaking_change_rule }}` | D-AI-BREAK-STRICT-MOBILE | Derivation |
| `{{ ai_platform_rule }}` | D-AI-PLATFORM-STRICT | Derivation |
| `{{ FIXED_RULES_* }}` | fixed-rules.md (14 chapters) | Fixed injection |
| `{{ deny_list_summary }}` | Phase 4 auto-extract | Auto-generated |
| `{{ recommended_libs }}` | Phase 4 platform+tools recommendation | Auto-generated |

**Self-check rule**: Before rendering, scan the output file. If any `{{ ... }}` string still remains, trace back to Phase 2/3 to fix.
