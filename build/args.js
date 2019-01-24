const yargs = require("yargs");

const config = require("./config");

const argv = yargs
	.alias("rel", "release")
	.default("rel", false)

	.choices("bump", ["major", "minor", "patch", "prerelease"])
	.default("bump", "patch")

	.default("fix", false)
	.default("versionSuffix", "rc")
	.default("reporters", config.test.reporters)
	.default("browsers", config.test.browsers)
	.default("continueOnError", false)

	.argv;

module.exports = {
	bump: argv.bump,
	versionSuffix: argv.versionSuffix,
	isRelease: argv.rel,
	fix: argv.fix,
	reporters: argv.reporters,
	browsers: [].concat(argv.browsers),
	continueOnError: argv.continueOnError
};