const path = require("path");
const fs = require("fs");

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const outputRoot = "./dist";
const srcRoot = "src";

module.exports = {
	output: {
		dist: outputRoot,
		artifact: "./_artifact",
	},
	src: {
		root: srcRoot,
		ts: `./${srcRoot}/**/*.ts`,
		testTs: `./${srcRoot}/**/*.spec.ts`,
		karmaConfig: "karma.conf.js"
	},
	test: {
		reporters: ["mocha"],
		browsers: ["Chrome"],
		setup: "test/test-setup.ts"
	},
	buildTargets: [
		"es2015",
		"umd"
	],
	devTarget: "umd",
	doc: "./doc",
	packageName: pkg.name
};