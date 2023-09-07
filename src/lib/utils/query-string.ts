import { Dictionary } from "./dictionary";

export function buildQueryString(data: Dictionary<string> | undefined): string {
	let queryString = "";
	if (!data) {
		return queryString;
	}
	// eslint-disable-next-line guard-for-in
	for (const key in data) {
		queryString += queryString === "" ? "?" : "&";
		queryString += `${key}=${data[key]}`;
	}
	return queryString;
}
