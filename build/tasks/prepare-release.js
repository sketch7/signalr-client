const gulp = require("gulp");
const runSequence = require("run-sequence");
const conventionalChangelog = require("gulp-conventional-changelog");
const bump = require("gulp-bump");

const args = require("../args");

var publishBranch;
gulp.task("prepare-release", (cb) => {
	args.isRelease = true;
	return runSequence(
		"bump-version",
		"changelog",
		cb);
});

// utils
// -------------

gulp.task("bump-version", () => {
	return gulp.src(["./package.json"])
		.pipe(bump({ type: args.bump, preid: args.versionSuffix })) //major|minor|patch|prerelease
		.pipe(gulp.dest("./"));
});

gulp.task("changelog", () => {
	return gulp.src("./CHANGELOG.md", {
		buffer: false
	})
		.pipe(conventionalChangelog({
			preset: "angular"
		}))
		.pipe(gulp.dest("."));
});