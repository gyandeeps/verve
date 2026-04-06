const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to enable android:largeHeap="true" in the AndroidManifest.xml.
 * This is required for loading large LLM models (like Phi-4) into memory.
 */
const withLargeHeap = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    const application = androidManifest.application?.[0];

    if (application) {
      application.$["android:largeHeap"] = "true";
      console.log("[withLargeHeap] Set android:largeHeap='true'");
    }

    return config;
  });
};

module.exports = withLargeHeap;
