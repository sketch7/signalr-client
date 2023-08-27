const gulp = require("gulp");
const ssvTools = require("@ssv/tools");

const args = require("../args");

gulp.task("lint:ts", () => ssvTools.lintTs({
	fix: args.fix
}));

gulp.task("compile:test", () => ssvTools.compileTsc({
	module: "es2015",
	configPath: "./tsconfig.test.json",
	continueOnError: args.continueOnError
}));

gulp.task("lint", gulp.parallel("lint:ts", "compile:test"));