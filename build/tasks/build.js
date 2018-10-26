const gulp = require("gulp");
const ssvTools = require("@ssv/tools");

const args = require("../args");
const config = require("../config");

require("./clean");
require("./lint");

ssvTools.registerGulpMultiTargetBuilds({
	taskName: "ts",
	action: compileTs,
	config: config
});

gulp.task("bundle:ts", () => ssvTools.rollup({ continueOnError: args.continueOnError }));

gulp.task("copy-dist", () => {
	return gulp.src(`${config.output.artifact}/**/*`)
		.pipe(gulp.dest(`${config.output.dist}`));
});

gulp.task("build", args.isRelease
	? gulp.series(
		gulp.parallel("lint", "compile:ts"),
		"copy-dist",
		"bundle:ts"
	)
	: gulp.series("lint", "compile:ts:dev")
)

gulp.task("rebuild", args.isRelease
	? gulp.series("clean", "build")
	: gulp.series("clean:artifact", "build")
)

gulp.task("ci", gulp.series("rebuild", "compile:test"));

// scripts - compile:ts | compile:ts:dev | compile:ts:TARGET
function compileTs(target) {
	return ssvTools.compileTsc({
		module: target,
		configPath: "./tsconfig.build.json",
		continueOnError: args.continueOnError
	});
}