const gulp = require("gulp");
const ssvTools = require("@ssv/tools");

const args = require("../args");
const config = require("../config");

require("./clean");

ssvTools.registerGulpMultiTargetBuilds({
	taskName: "ts",
	action: compileTs,
	config: config
});

gulp.task("bundle:ts", () => ssvTools.rollup({ continueOnError: args.continueOnError, useTypeScriptConfig: true }));
gulp.task("build:resources", () => ssvTools.buildResources(config.output.dist));
gulp.task("prebuild:rel", () => ssvTools.prepareReleaseBuild({
	shouldSkip: !process.env.CI
}));
gulp.task("build:microbundle", () => ssvTools.microbundle({
	continueOnError: args.continueOnError
}))

gulp.task("build", args.isRelease
	? gulp.series(
		"prebuild:rel",
		gulp.parallel("compile:ts", "build:resources"),
		"bundle:ts"
	)
	: gulp.parallel("compile:ts:dev", "build:resources")
)

gulp.task("rebuild", gulp.series("clean", "build"))

gulp.task("ci", gulp.series("rebuild", "compile:test"));

gulp.task("compile:test", () => ssvTools.compileTsc({
	module: "es2015",
	configPath: "./tsconfig.test.json",
	continueOnError: args.continueOnError
}));

// scripts - compile:ts | compile:ts:dev | compile:ts:TARGET
function compileTs(target) {
	return ssvTools.compileTsc({
		module: target,
		configPath: "./tsconfig.build.json",
		continueOnError: args.continueOnError
	});
}

