const gulp = require("gulp");
const del = require("del");

const config = require("../config");

gulp.task("clean", () => {
	return del(config.output.dist);
});