const gulp = require("gulp");
const del = require("del");

const config = require("../config");

gulp.task("clean:artifact", () => {
	return del(config.output.artifact);
});

gulp.task("clean:dist", () => {
	return del(config.output.dist);
});

gulp.task("clean", gulp.parallel("clean:artifact", "clean:dist"));