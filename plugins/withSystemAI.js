const { withInfoPlist, withAndroidManifest } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to enable System-First AI capabilities.
 *
 * iOS: Adds Neural Engine usage description.
 * Android: Registers AICore metadata and native text classifier libraries.
 */
const withSystemAI = (config) => {
  // 1. iOS Info.plist configuration
  config = withInfoPlist(config, (config) => {
    config.modResults.NSNeuralEngineUsageDescription =
      "Verve uses the Neural Engine for private, on-device AI analysis of cognitive load data.";
    // Ensure high deployment target for Apple Intelligence (Foundation Models)
    if (!config.ios) config.ios = {};
    config.ios.deploymentTarget = "18.0";
    return config;
  });

  // 2. Android AndroidManifest.xml configuration
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    // Add AICore metadata
    if (!mainApplication["meta-data"]) {
      mainApplication["meta-data"] = [];
    }

    // Example metadata for Gemini Nano / AICore support
    mainApplication["meta-data"].push({
      $: {
        "android:name": "com.google.android.gms.metadata.GEN_AI_MODEL_NAME",
        "android:value": "gemini-nano",
      },
    });

    // Add native library requirement for text classification
    if (!mainApplication["uses-native-library"]) {
      mainApplication["uses-native-library"] = [];
    }
    mainApplication["uses-native-library"].push({
      $: {
        "android:name": "libtextclassifier.so",
        "android:required": "false",
      },
    });

    return config;
  });

  return config;
};

module.exports = withSystemAI;
