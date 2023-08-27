const gulp = require("gulp");
const ssvTools = require("@ssv/tools");

gulp.task("prebuild:rel", () => ssvTools.prepareReleaseBuild({
	shouldSkip: !process.env.CI
}));