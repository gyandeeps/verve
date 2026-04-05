# Android Health Connect Stability & Integration

This document outlines the technical challenges encountered while integrating the `react-native-health-connect` library into the Verve Expo application and the robust solution implemented to ensure stability on Android 14+.

## The Issues

### 1. The "Lateinit" Crash

**Error:** `kotlin.UninitializedPropertyAccessException: lateinit property requestPermission has not been initialized`

**Root Cause:** The `react-native-health-connect` library uses an `ActivityResultLauncher` to handle permission requests. This launcher **must** be registered during the Activity's creation phase (`onCreate`). The library provides a `HealthConnectPermissionDelegate.setPermissionDelegate(this)` method for this purpose.

In an Expo managed workflow, the `MainActivity` is generated automatically. The library's default config plugin adds the necessary `AndroidManifest.xml` entries but **fails to inject the required Kotlin code into MainActivity.kt**. Consequently, the property remained uninitialized, causing a fatal crash whenever `requestPermission()` was called.

### 2. The "Invisible Permissions" Issue

**Symptom:** The permission dialog would launch (the app would background), but it would return immediately as "Denied" without ever showing the Heart Rate permission checkboxes.

**Root Cause (Android 14+):** Starting with Android 14 (Target SDK 34), Health Connect requires an `activity-alias` in the manifest named `ViewPermissionUsageActivity`. This alias must handle the `ACTION_VIEW_PERMISSION_USAGE` intent. Without this specific wiring, Health Connect cannot display the "Rationale" screen or the individual permission toggles for the application.

### 3. Mangled Intent Filters

**Symptom:** Warning logs regarding invalid intent filters in the manifest.

**Root Cause:** Defining intent filters directly in `app.json` under `expo.android.intentFilters` causes Expo to automatically prepend `android.intent.action.` to the action name. This resulted in an invalid action string: `android.intent.action.androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`.

---

## The Solution: Custom Expo Config Plugin

To solve these issues without abandoning the managed workflow (i.e., without manually maintaining the `android/` folder), we created a custom Expo Config Plugin: `plugins/withHealthConnectPermissionDelegate.js`.

### Why a Plugin?

We chose a config plugin approach over manual "bare" modifications for several reasons:

- **Reproducibility:** The native changes are applied automatically during `npx expo prebuild`. This ensures that any developer (or CI/CD system like EAS) can generate a working native build from the source code.
- **Maintainability:** We don't have to check the `android/` folder into version control, reducing repo bloat and potential merge conflicts in native code.
- **Precision:** The plugin uses regex to safely inject the `setPermissionDelegate` call into the correct lifecycle method (`onCreate`) of the generated `MainActivity.kt`.

### Implementation Details

#### 1. MainActivity Injection

The plugin identifies the `onCreate` method in `MainActivity.kt` and injects:

```kotlin
HealthConnectPermissionDelegate.setPermissionDelegate(this)
```

This ensures the `ActivityResultLauncher` is ready before the JS layer attempts to request permissions.

#### 2. Manifest Activity-Alias

The plugin modifies the `AndroidManifest.xml` to include the required alias for Android 14+ support:

```xml
<activity-alias
    android:name="ViewPermissionUsageActivity"
    android:exported="true"
    android:targetActivity=".MainActivity"
    android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
    <intent-filter>
        <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
        <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
    </intent-filter>
</activity-alias>
```

#### 3. Cleanup

We removed the manual `intentFilters` from `app.json` to allow the library's built-in plugin (which we still use for base permissions) to manage the rationale intent filter correctly without mangling the strings.

---

## Technical Verification

- **Crash Prevention:** Verified that `requestPermission()` no longer throws the uninitialized property exception.
- **Permission Flow:** Verified that the Health Connect UI correctly displays the "Heart Rate" toggle and returns the proper grant status to the app.
- **Stability Guard:** The `isPermissionFlowActive` flag remains in `HealthService.android.ts` and `monitor.tsx`. This flag prevents the app's internal TCP connection from being severed when Health Connect pushes the app to the background to show the permission dialog.

## Definition of Done (Android Health)

- [x] No `lateinit` crashes on permission request.
- [x] Correct manifestation of the `ViewPermissionUsageActivity` alias.
- [x] Heart Rate toggles visible in native Health Connect UI.
- [x] App maintains TCP state (via `isPermissionFlowActive` guard) during the auth flow.
