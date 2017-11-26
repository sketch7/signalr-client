const gulp = require("gulp");
const del = require("del");

const config = require("../config");

gulp.task("clean", ["clean:artifact", "clean:dist"]);

gulp.task("clean:artifact", () => {
	return del(config.output.artifact);
});

gulp.task("clean:dist", () => {
	return del(config.output.dist);
});