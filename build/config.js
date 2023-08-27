const fs = require("fs");

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

module.exports = {
	packageName: pkg.name
};