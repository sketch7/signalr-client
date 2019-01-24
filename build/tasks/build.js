const gulp = require("gulp");
const ssvTools = require("@ssv/tools");

const args = require("../args");
const config = require("../config");

require("./clean");
require("./lint");

// ssvTools.registerGulpMultiTargetBuilds({
// 	taskName: "ts",
// 	action: compileTs,
// 	config: config
// });

// gulp.task("bundle:ts", () => ssvTools.rollup({ continueOnError: args.continueOnError, useTypeScriptConfig: true }));
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
		gulp.parallel("build:microbundle", "build:resources"),
		// "bundle:ts"
	)
	: gulp.parallel("build:microbundle", "build:resources" )
)

gulp.task("rebuild", gulp.series("clean", "build"))

gulp.task("ci", gulp.series("rebuild", "compile:test"));


// // scripts - compile:ts | compile:ts:dev | compile:ts:TARGET
// function compileTs(target) {
// 	return ssvTools.compileTsc({
// 		module: target,
// 		configPath: "./tsconfig.build.json",
// 		continueOnError: args.continueOnError
// 	});
// }

