import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APP_JSON_PATH = join(process.cwd(), "app.json");
const PACKAGE_JSON_PATH = join(process.cwd(), "package.json");

function bumpVersion() {
  try {
    // 1. Read app.json
    const appJsonContent = readFileSync(APP_JSON_PATH, "utf8");
    const appJson = JSON.parse(appJsonContent);
    const oldVersion = appJson.expo.version || "0.0.1";

    // 2. Parse and increment patch version
    const parts = oldVersion.split(".");
    if (parts.length !== 3) {
      console.error(`Invalid version format in app.json: ${oldVersion}`);
      process.exit(1);
    }

    parts[2] = (parseInt(parts[2], 10) + 1).toString();
    const newVersion = parts.join(".");

    // 3. Increment android.versionCode
    const oldVersionCode = appJson.expo.android?.versionCode || 0;
    const newVersionCode = oldVersionCode + 1;

    // Update app.json
    appJson.expo.version = newVersion;
    if (!appJson.expo.android) appJson.expo.android = {};
    appJson.expo.android.versionCode = newVersionCode;

    writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2) + "\n");
    console.log(
      `✅ app.json: ${oldVersion} (vc: ${oldVersionCode}) -> ${newVersion} (vc: ${newVersionCode})`,
    );

    // 4. Update package.json
    const packageJsonContent = readFileSync(PACKAGE_JSON_PATH, "utf8");
    const packageJson = JSON.parse(packageJsonContent);
    packageJson.version = newVersion;

    writeFileSync(
      PACKAGE_JSON_PATH,
      JSON.stringify(packageJson, null, 2) + "\n",
    );
    console.log(`✅ package.json: ${newVersion}`);
  } catch (err) {
    console.error("Failed to bump version:", err);
    process.exit(1);
  }
}

bumpVersion();
