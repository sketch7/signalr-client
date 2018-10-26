const gulp = require("gulp");
const util = require("gulp-util");

const args = require("../args");
const config = require("../config");

gulp.task("watch", () => {
	args.continueOnError = true;
	// ts
	gulp.watch([config.src.ts, `!${config.src.testTs}`],
		args.isRelease
			? gulp.series("compile:ts:dev", "copy-dist")
			: gulp.series("compile:ts:dev"))
		.on("change", reportChange)
		.on("error", swallowError);
});

function reportChange(event) {
	console.log(`File ${event.path} was ${event.type}, running tasks...`);
}

function swallowError(error) {
	console.log(util.colors.red("Error occurred while running watched task..."));
}