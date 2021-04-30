module.exports = {
	root: true,
	parserOptions: {
		project: ["./tsconfig.json"]
	},
	plugins: [
		"@typescript-eslint"
	],
	extends: [
		"plugin:@typescript-eslint/recommended"
	],
};