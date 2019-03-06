import fs from "fs";
const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

const pkgName = pkg.name.replace("@", "").replace(/(\/|\.)/g, "-");

module.exports = {
	input: pkg.module,
	output: [
		{ file: pkg.main, format: "umd", name: pkgName, sourcemap: true },
		{ file: pkg.module, format: "es", sourcemap: true }
	],
	external: id => id.indexOf("node_modules") > -1,
	onwarn
};

function onwarn(warning) {
	const suppressed = [
		"UNRESOLVED_IMPORT",
		"MISSING_GLOBAL_NAME",
		"THIS_IS_UNDEFINED"
	];

	if (!suppressed.find(code => warning.code === code)) {
		return console.warn(warning.message);
	}
}