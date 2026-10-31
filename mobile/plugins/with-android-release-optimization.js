const {
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
} = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

// Keep release optimization enabled after Expo regenerates android/ locally or on EAS.
module.exports = function withAndroidReleaseOptimization(config) {
  config = withDangerousMod(config, ["android", async (config) => {
    const file = path.join(config.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
    const contents = await fs.readFile(file, "utf8");
    const rule = "-keep class com.google.android.gms.internal.consent_sdk.** { *; }";
    if (!contents.includes(rule)) {
      await fs.writeFile(file, `${contents}\n# Preserve UMP consent forms in release builds.\n${rule}\n`);
    }
    return config;
  }]);
  config = withGradleProperties(config, (config) => {
    const properties = {
      "android.enableMinifyInReleaseBuilds": "true",
      "android.enableShrinkResourcesInReleaseBuilds": "true",
    };

    config.modResults = config.modResults.filter(
      (entry) => entry.type !== "property" || !(entry.key in properties),
    );
    for (const [key, value] of Object.entries(properties)) {
      config.modResults.push({ type: "property", key, value });
    }
    return config;
  });

  return withAppBuildGradle(config, (config) => {
    const defaultRules = /getDefaultProguardFile\((['"])proguard-android(?:-optimize)?\.txt\1\)/g;
    if (config.modResults.language !== "groovy" || !defaultRules.test(config.modResults.contents)) {
      throw new Error("Android release optimization requires the Expo Groovy ProGuard configuration.");
    }

    // Expo SDK 54 converts SecureStore options through Kotlin reflection.
    // R8 optimization breaks that conversion; retain shrinking/obfuscation only.
    config.modResults.contents = config.modResults.contents.replace(
      defaultRules,
      'getDefaultProguardFile("proguard-android.txt")',
    );
    return config;
  });
};
