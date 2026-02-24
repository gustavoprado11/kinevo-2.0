/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "WorkoutActivity",
  bundleIdentifier: ".WorkoutActivity",
  deploymentTarget: "16.2",
  frameworks: ["ActivityKit", "WidgetKit", "SwiftUI"],
};
