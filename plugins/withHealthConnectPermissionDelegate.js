/**
 * Custom Expo Config Plugin: withHealthConnectPermissionDelegate
 *
 * Fixes TWO issues that the react-native-health-connect library's built-in
 * Expo plugin (app.plugin.js) does not handle:
 *
 * 1. MAINACTIVITY: Injects `HealthConnectPermissionDelegate.setPermissionDelegate(this)`
 *    into MainActivity.onCreate(). This registers the ActivityResultLauncher
 *    that the `requestPermission()` API depends on. Without it, the
 *    `requestPermission` lateinit property is never initialized, causing a
 *    fatal UninitializedPropertyAccessException crash.
 *
 * 2. MANIFEST: Adds a `ViewPermissionUsageActivity` activity-alias to the
 *    AndroidManifest. On Android 14+ (targetSdk 34+), Health Connect
 *    requires this alias with an ACTION_VIEW_PERMISSION_USAGE intent-filter
 *    so the permission dialog can show the list of requested permissions.
 *    Without it, the permission dialog launches but shows an empty list
 *    and returns immediately with no grants.
 */
const {
  withMainActivity,
  withAndroidManifest,
} = require("@expo/config-plugins");

const withHealthConnectPermissionDelegate = (config) => {
  // ── Step 1: Modify MainActivity.kt ────────────────────────────────
  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // Guard: Don't double-apply
    if (contents.includes("setPermissionDelegate")) {
      return config;
    }

    // Add import
    const hcImport =
      "import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate";
    if (!contents.includes(hcImport)) {
      const lastImportIndex = contents.lastIndexOf("import ");
      const endOfLastImportLine = contents.indexOf("\n", lastImportIndex);
      contents =
        contents.slice(0, endOfLastImportLine + 1) +
        hcImport +
        "\n" +
        contents.slice(endOfLastImportLine + 1);
    }

    // Inject setPermissionDelegate into onCreate
    if (contents.includes("override fun onCreate")) {
      // Match super.onCreate(...) with any argument
      contents = contents.replace(
        /super\.onCreate\([^)]*\)\s*\n/,
        (match) =>
          match +
          "    HealthConnectPermissionDelegate.setPermissionDelegate(this)\n",
      );
    } else {
      // Fallback: add a full onCreate override
      const onCreateBlock = `
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    HealthConnectPermissionDelegate.setPermissionDelegate(this)
  }
`;
      const classBodyEnd = contents.lastIndexOf("}");
      contents =
        contents.slice(0, classBodyEnd) +
        onCreateBlock +
        contents.slice(classBodyEnd);
    }

    config.modResults.contents = contents;
    return config;
  });

  // ── Step 2: Modify AndroidManifest.xml ────────────────────────────
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    if (!application) return config;

    // Guard: Don't double-apply
    const existingAlias = application["activity-alias"] || [];
    const alreadyAdded = existingAlias.some(
      (alias) => alias.$?.["android:name"] === "ViewPermissionUsageActivity",
    );

    if (alreadyAdded) return config;

    // Add the activity-alias required for Health Connect permissions on Android 14+.
    // This tells Health Connect where to route the permission rationale screen.
    if (!application["activity-alias"]) {
      application["activity-alias"] = [];
    }

    application["activity-alias"].push({
      $: {
        "android:name": "ViewPermissionUsageActivity",
        "android:exported": "true",
        "android:targetActivity": ".MainActivity",
        "android:permission": "android.permission.START_VIEW_PERMISSION_USAGE",
      },
      "intent-filter": [
        {
          action: [
            {
              $: {
                "android:name": "android.intent.action.VIEW_PERMISSION_USAGE",
              },
            },
          ],
          category: [
            {
              $: {
                "android:name": "android.intent.category.HEALTH_PERMISSIONS",
              },
            },
          ],
        },
      ],
    });

    return config;
  });

  return config;
};

module.exports = withHealthConnectPermissionDelegate;
