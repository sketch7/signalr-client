const gulp = require("gulp");
const runSeq = require("run-sequence");
const sourcemaps = require("gulp-sourcemaps");
const ssvTools = require("@ssv/tools");

const args = require("../args");
const config = require("../config");

gulp.task("build", (cb) => {
	if (args.isRelease) {
		return runSeq(
			["lint", "compile:ts"],
			"copy-dist",
			"bundle:ts",
			cb);
	}
	return runSeq(
		["lint", "compile:ts:dev"],
		cb);
});

gulp.task("rebuild", (cb) => {
	if (args.isRelease) {
		return runSeq(
			"clean",
			"build",
			cb);
	}
	return runSeq(
		"clean:artifact",
		"build",
		cb);
});

gulp.task("ci", (cb) => {
	return runSeq(
		"rebuild",
		"compile:test",
		cb);
});

// scripts - compile:ts | compile:ts:dev | compile:ts:TARGET
function compileTs(target) {
	return ssvTools.compileTsc({
		module: target,
		configPath: "./tsconfig.build.json",
		continueOnError: args.continueOnError
	});
}
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