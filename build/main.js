const gulp = require("gulp");
const ssvTools = require("@ssv/tools");

const config = require("./config");
ssvTools.setGulpContext(gulp);

require("require-dir")("./tasks");

gulp.task("default", cb => {
	console.log(`======== ${config.packageName} ========`);
	cb();
});