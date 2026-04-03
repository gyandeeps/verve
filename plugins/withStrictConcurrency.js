const { withXcodeProject } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to set SWIFT_STRICT_CONCURRENCY to 'minimal'.
 * This resolves build failures where the Swift 6 compiler (Xcode 16+) 
 * is too strict for certain Expo modules or older Swift code.
 */
module.exports = function withStrictConcurrency(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    
    // Set the build setting for all targets in the Xcode project
    xcodeProject.addBuildProperty("SWIFT_STRICT_CONCURRENCY", "minimal");
    
    return config;
  });
};
