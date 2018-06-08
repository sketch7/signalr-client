import * as SUT from "./query-string";

describe("QueryString Utils", () => {

	describe("buildQueryStringSpecs", () => {

		describe("given an undefined dictionary", () => {
			it("should replace return an empty string", () => {
				const result = SUT.buildQueryString(undefined);
				expect(result).toBe("");
			});
		});

		describe("given an empty dictionary", () => {
			it("should replace return an empty string", () => {
				const result = SUT.buildQueryString({});
				expect(result).toBe("");
			});
		});

		describe("when having dictionary with one item", () => {
			it("should replace all values", () => {
				const result = SUT.buildQueryString({ token: "user-id" });
				expect(result).toBe("?token=user-id");
			});
		});

		describe("when having dictionary with multiple items", () => {
			it("should build query string with all values", () => {
				const result = SUT.buildQueryString({ token: "user-id", category: "mobile" });
				expect(result).toBe("?token=user-id&category=mobile");
			});
		});
	});

});
