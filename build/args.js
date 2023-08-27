const yargs = require("yargs");

const argv = yargs
	.alias("rel", "release")
	.default("rel", false)

	.default("fix", false)
	.default("continueOnError", false)

	.argv;

module.exports = {
	isRelease: argv.rel,
	fix: argv.fix,
	continueOnError: argv.continueOnError
};