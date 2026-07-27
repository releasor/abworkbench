# Fixed Rules — Complete Mobile Fixed Rules

> This file is read by the `mobile-rules` skill in Phase 1 and injected directly into `mobile-rules.md`.
> These rules are industry consensus / best practices — **do not ask the user**.
> Every rule includes RATIONALE so the AI understands intent, not just constraints.

---

## F1. Project Structure

### F1.1 Platform Directory Conventions

- **Rule**: Project root must clearly separate platform-specific code from shared code:
  - Flutter: `lib/` (Dart), `test/`, `ios/`, `android/`
  - React Native: `src/`, `ios/`, `android/`, `app.json`
  - iOS: `AppName/` (Swift sources), `AppNameTests/`, `AppName.xcodeproj`
  - Android: `app/src/main/java/`, `app/src/test/`, `app/build.gradle`
- **Rule**: Shared cross-platform code goes in `shared/` or `core/` directory.
- **Forbidden**: Mixing platform-specific and cross-platform code in the same directory.
- **RATIONALE**: Clean platform separation is the first defense against accidental platform coupling.

### F1.2 Module Organization

- **Rule**: Organize source by feature/module, not by technical layer (e.g., `features/auth/`, not `models/` + `views/` + `controllers/`).
- **Rule**: Within each feature directory, enforce the chosen architecture pattern (MVVM/Clean Architecture/MVI).
- **Forbidden**: Circular dependencies between feature modules.
- **RATIONALE**: Feature-based organization keeps related code together and limits blast radius of changes.

### F1.3 Naming Conventions

- **Flutter**: File names snake_case (`user_profile_screen.dart`). Widget classes PascalCase.
- **React Native**: Component files PascalCase (`UserProfileScreen.tsx`). Hooks `useXxx.ts`.
- **iOS/Swift**: Files PascalCase (`UserProfileView.swift`). Protocols start with describable verb.
- **Android/Kotlin**: Files PascalCase (`UserProfileScreen.kt`). Layout XML snake_case.
- **RATIONALE**: Consistent naming lets AI and developers find files by convention alone.

---

## F2. UI Development

### F2.1 Component/Widget Principles

- **Rule**: UI components must be single-responsibility. One component does one visual unit.
- **Rule**: Pass data down, emit events up. Forbid bidirectional data binding between parent and child.
- **Rule**: Every UI component must specify explicit sizing behavior (intrinsic, expanded, fixed). Forbid relying on implicit defaults.
- **Forbidden**: Hardcoding colors, font sizes, or spacing values in UI code. Use design tokens or theme.
- **RATIONALE**: UI is the most change-prone layer. Single-responsibility components make changes localized.

### F2.2 Platform UI Conventions

- **Rule**: Follow platform HIG (Human Interface Guidelines) for navigation patterns:
  - iOS: tab bar at bottom, back swipe gesture, navigation bar with large titles
  - Android: navigation drawer or bottom nav, back button (system), app bar
- **Rule**: Touch targets must be ≥ 44pt (iOS) / 48dp (Android). Smaller targets need padding.
- **Forbidden**: Copying UI patterns from one platform to another without adapting to HIG.
- **RATIONALE**: Users expect platform-native behavior. Violating HIG causes rejection from App Store review.

### F2.3 Adaptive Layout

- **Rule**: UI must adapt to safe areas (notch, home indicator, camera cutout).
- **Rule**: Support both portrait and landscape on iPad/tablet. Phone may lock to portrait.
- **Rule**: Text must support Dynamic Type / font scaling (1x–3x). Test with largest accessibility text size.
- **Forbidden**: Using fixed pixel dimensions for text containers.
- **RATIONALE**: Device fragmentation is orders of magnitude worse on mobile than on web.

---

## F3. Navigation & Deep Linking

### F3.1 Navigation Patterns

- **Rule**: Navigation flow must be predictable. Back button/gesture always goes to the previous screen.
- **Rule**: Deep links must resolve to a specific screen regardless of app launch state (cold start, background, foreground).
- **Rule**: Navigation state must survive process death (save/restore navigation stack).
- **Forbidden**: Modifying the navigation stack during transition animations.
- **RATIONALE**: Broken navigation is the #1 cause of mobile app user frustration and 1-star reviews.

### F3.2 Deep Linking

- **Rule**: All deep link routes must be validated before navigation. Forbid navigating to arbitrary URLs.
- **Rule**: Universal Links (iOS) / App Links (Android) must be configured with the correct `apple-app-site-association` / `assetlinks.json`.
- **Rule**: Deep link handling must work with both custom scheme (`myapp://`) and HTTPS (`https://myapp.com/`).
- **RATIONALE**: Deep links are an attack surface (open redirect). Unvalidated deep links can expose sensitive screens.

---

## F4. State Management Principles

- **Rule**: UI state must be separated from business state. UI state belongs in the View/Widget. Business state belongs in ViewModel/Bloc/Store.
- **Rule**: State changes must be observable and traceable. Forbid silently mutating shared state.
- **Rule**: Long-lived state (user session, cached data) must survive configuration changes / process death.
- **Forbidden**: Using global mutable variables as state containers.
- **RATIONALE**: Uncontrolled shared mutable state is the root of all mobile app heisenbugs — bugs that vanish when you try to reproduce them.

---

## F5. Networking

### F5.1 API Communication

- **Rule**: All API calls must handle: success, network error, timeout, server error (4xx/5xx), and empty response.
- **Rule**: Network requests must be cancellable (dispose on screen exit to prevent memory leaks and stale UI updates).
- **Rule**: Sensitive data in transit must use HTTPS with certificate pinning for production builds.
- **Forbidden**: Making network calls on the main/UI thread.
- **RATIONALE**: Mobile networks are unreliable by nature. Every network call needs full error handling or it will crash your app.

### F5.2 Offline & Caching

- **Rule**: Critical flows must work offline or show graceful degradation (not a white screen).
- **Rule**: Network responses should be cached with TTL. Stale cache is better than no data.
- **Rule**: Offline mutations must be queued and synced when connectivity returns, with conflict resolution.
- **RATIONALE**: Airplane mode, tunnels, elevators — mobile apps must assume connectivity is intermittent.

---

## F6. Data Persistence

### F6.1 Local Storage

- **Rule**: Choose the right storage for the data type: structured → SQLite, KV → DataStore/MMKV/Hive, files → app sandbox, credentials → Keychain/Keystore.
- **Rule**: Database migrations must be versioned and tested. Forbid destructive migrations (drop column/table) without a backup step.
- **Forbidden**: Storing sensitive data (tokens, passwords, PII) in plaintext in any local storage.
- **RATIONALE**: Local storage is not encrypted by default on all platforms. Assume the device can be compromised.

### F6.2 Encryption

- **Rule**: Authentication tokens must be stored in Keychain (iOS) / EncryptedSharedPreferences or Keystore (Android).
- **Rule**: Local databases containing PII must use SQLCipher or platform-level encryption.
- **Forbidden**: Hardcoding encryption keys in source code.
- **RATIONALE**: The mobile device is a hostile environment — jailbroken/rooted devices can access app sandboxes.

---

## F7. Platform Features

### F7.1 Permissions

- **Rule**: Request permissions at the time of use, not at app launch (except for critically required permissions with explanation).
- **Rule**: Handle all permission outcomes: granted, denied, denied permanently ("Don't ask again").
- **Rule**: When a permission is permanently denied, guide the user to system Settings with a clear explanation of why it's needed.
- **Forbidden**: Crashing or silently failing when a permission is denied.
- **RATIONALE**: Permission rejection rates are high (30-50% for camera/mic). Crashing on denial is a guaranteed crash report.

### F7.2 Background Tasks

- **Rule**: Background work must use the platform's recommended API:
  - iOS: BGTaskScheduler (short, scheduled) or BGAppRefreshTask
  - Android: WorkManager (deferrable) or Foreground Service (user-visible)
- **Rule**: Background tasks must be battery-efficient. Forbid polling every few seconds in the background.
- **Rule**: Background task results must be persisted before task completion (system may kill the process).
- **RATIONALE**: Mobile OSes aggressively kill background processes. Using the wrong background API means your task never runs.

### F7.3 Push Notifications

- **Rule**: Notification content must be localized. Forbid hardcoding notification text in English only.
- **Rule**: Notification tap must navigate to the relevant screen, not just open the app.
- **Rule**: Handle FCM/APNs token refresh. Stale tokens cause silent notification delivery failure.
- **Forbidden**: Sending sensitive data (passwords, PII) in notification payloads.
- **RATIONALE**: Notifications are the primary re-engagement channel. Broken deep links from notifications mean lost users.

---

## F8. Performance

### F8.1 Main Thread

- **Rule**: UI thread (main thread) must stay at 60fps (16ms/frame) or 120fps (8ms/frame). Any work > 1ms offloads to background.
- **Rule**: JSON parsing, image decoding, database queries must run off the main thread.
- **Forbidden**: Synchronous I/O on the main thread.
- **RATIONALE**: Jank (dropped frames) is immediately visible to users. A single 100ms main-thread block drops 6 frames at 60fps.

### F8.2 Memory

- **Rule**: Avoid memory leaks: unregister listeners/observers in dispose/deinit/onDestroy.
- **Rule**: Image memory: load scaled images (not full resolution into a thumbnail). Use image caching libraries.
- **Rule**: Monitor memory warnings. Release cached data when the system sends a memory warning.
- **Forbidden**: Holding references to Activity/Fragment/ViewController after they're destroyed.
- **RATIONALE**: Mobile OSes kill apps that exceed memory limits. Memory leaks accumulate and eventually cause OOM crashes.

### F8.3 App Size

- **Rule**: App download size target < 100MB (cellular download limit for many regions).
- **Rule**: Use App Bundles (Android) / App Thinning (iOS) for platform-optimized delivery.
- **Rule**: Large assets (videos, models) should be downloaded on-demand after install, not bundled.
- **RATIONALE**: App size directly impacts install conversion. Every 10MB above 100MB loses ~1% of potential installs.

---

## F9. Accessibility

- **Rule**: All interactive elements must have accessibility labels (contentDescription / accessibilityLabel).
- **Rule**: Decorative images must be marked as not important for accessibility.
- **Rule**: Color must not be the sole means of conveying information (pair with icon or text).
- **Rule**: Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text (≥18pt bold or ≥24pt).
- **Rule**: Support system font scaling up to 2x without layout breaking or text truncation.
- **RATIONALE**: 15% of the world's population has some form of disability. Accessibility is not optional — it's also increasingly an App Store review requirement.

---

## F10. Security

### F10.1 App Hardening

- **Rule**: Release builds must enable code minification/obfuscation (ProGuard/R8 for Android, strip symbols for iOS).
- **Rule**: Jailbreak/root detection recommended for financial, healthcare, or enterprise apps.
- **Rule**: Screenshot/screen recording prevention for sensitive screens (banking, health records).
- **Forbidden**: Leaving debug logs, debug menus, or development endpoints in release builds.
- **RATIONALE**: A released app is a binary that anyone can decompile. Defense in depth is the only strategy.

### F10.2 Data Protection

- **Rule**: App sandbox file protection: `NSFileProtectionComplete` (iOS) / device-encrypted storage (Android).
- **Rule**: API keys must not be stored in the app bundle. Use server-side proxy or secure enclave.
- **Rule**: User sessions must expire. Token refresh must require re-authentication for sensitive operations.
- **RATIONALE**: The app binary is distributed to attacker-controlled devices. Assume everything in the binary is public knowledge.

---

## F11. Testing

- **Rule**: Testing has three tiers:
  - Unit tests: ViewModels/Blocs/UseCases/Repositories (fast, no UI)
  - Widget/Component tests: individual UI components in isolation (medium speed, fake dependencies)
  - Integration/E2E tests: critical user flows through real screens (slow, real or staged backend)
- **Rule**: Tests must be deterministic. Forbid relying on real network calls, real time, or random values without seeding.
- **Rule**: Golden/image snapshot tests must use the same OS version and device configuration for consistency.
- **RATIONALE**: Mobile testing is harder than backend testing because it spans UI, platform APIs, and network. Clear tiers prevent confusion about what to test where.

---

## F12. App Distribution

- **Rule**: Version code/number must be incremented for every build submitted to store.
- **Rule**: Staged rollout: 10% → 50% → 100% over 48 hours. Monitor crash rate at each stage.
- **Rule**: Release notes must be localized for all supported languages.
- **Rule**: Keep a version history document: what changed, why, and the minimal OS version bump if any.
- **RATIONALE**: A bad release can't be undone instantly (store rollback takes hours). Staged rollout is the cheapest insurance.

---

## F13. AI Vibecoding Baseline Constraints (project-agnostic, always active)

### F13.1 Search First
- **Rule**: Before creating a new widget/component/screen, AI must search existing code for similar implementations.
- **Rule**: Before adding a new dependency, AI must check if an existing dependency already covers that use case.

### F13.2 Platform Awareness
- **Rule**: AI must know which platform it's writing code for. iOS patterns in Android code (or vice versa) must be flagged explicitly.
- **Rule**: AI-generated code that uses platform-specific APIs must include the API level/iOS version availability annotation.

### F13.3 Dependency Control
- **Rule**: AI must not modify `pubspec.yaml` / `package.json` / `Podfile` / `build.gradle` on its own.
- **Rule**: If a new dependency is needed, AI must list: package name, version, reason, alternative comparison.

### F13.4 Breaking Changes
- **Rule**: Before modifying a shared widget/component/utility, AI must list all callers and assess platform impact.
- **Rule**: Changing navigation routes or deep link schemes requires assessing all entry points.

### F13.5 Context Honesty
- **Rule**: When uncertain about a platform API availability, behavior, or deprecation status, AI must explicitly say "I'm not sure" and suggest the developer verify against the platform documentation.

### F13.6 Security
- **Rule**: AI must not generate code that stores secrets in the app bundle, logs sensitive data, or disables ATS/SSL verification.

---

## Injection Instructions (for the AI executing this skill)

Each chapter in this file corresponds to a `{{ FIXED_RULES_* }}` placeholder in the template:

| Chapter | Inject Into Placeholder | Template Section |
|---------|------------------------|-------------------|
| F1 Project Structure | `{{ FIXED_RULES_STRUCTURE }}` | §1 Project Structure |
| F2 UI Development | `{{ FIXED_RULES_UI }}` | §2 UI Development |
| F3 Navigation | `{{ FIXED_RULES_NAVIGATION }}` | §3 Navigation & Deep Linking |
| F4 State Management | `{{ FIXED_RULES_STATE }}` | §4 State Management |
| F5 Networking | `{{ FIXED_RULES_NETWORKING }}` | §5 Networking |
| F6 Data Persistence | `{{ FIXED_RULES_PERSISTENCE }}` | §6 Data Persistence |
| F7 Platform Features | `{{ FIXED_RULES_PLATFORM_FEATURES }}` | §7 Platform Features |
| F8 Performance | `{{ FIXED_RULES_PERFORMANCE }}` | §8 Performance |
| F9 Accessibility | `{{ FIXED_RULES_A11Y }}` | §9 Accessibility |
| F10 Security | `{{ FIXED_RULES_SECURITY }}` | §10 Security |
| F11 Testing | `{{ FIXED_RULES_TEST }}` | §11 Testing |
| F12 Distribution | `{{ FIXED_RULES_DISTRIBUTION }}` | §12 Distribution |
| F13 AI Constraints | `{{ FIXED_RULES_AI_BASE }}` | §13 AI Behavior Constraints |

**Rendering rules**:
1. Copy each chapter's full body (including RATIONALE) directly into the corresponding placeholder.
2. RATIONALE must be preserved — it lets AI understand intent rather than follow mechanically.
3. Keep the original markdown list structure. Do not rewrite as prose paragraphs.
