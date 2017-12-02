import { Dictionary } from "./dictionary";

export function buildQueryString(data: Dictionary<string> | undefined) {
	let queryString = "";
	if (!data) {
		return queryString;
	}
	// tslint:disable-next-line:forin
	for (const key in data) {
		queryString += queryString === "" ? "?" : "&";
		queryString += `${key}=${data[key]}`;
	}
	return queryString;
}