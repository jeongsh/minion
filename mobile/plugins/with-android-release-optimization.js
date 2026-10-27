const {
  withAppBuildGradle,
  withGradleProperties,
} = require("expo/config-plugins");

// Keep release optimization enabled after Expo regenerates android/ locally or on EAS.
module.exports = function withAndroidReleaseOptimization(config) {
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

    // proguard-android.txt contains -dontoptimize; use the optimizing defaults.
    config.modResults.contents = config.modResults.contents.replace(
      defaultRules,
      'getDefaultProguardFile("proguard-android-optimize.txt")',
    );
    return config;
  });
};
