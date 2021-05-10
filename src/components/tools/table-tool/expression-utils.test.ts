import { canonicalizeExpression, prettifyExpression, validateExpression } from "./expression-utils";

describe("Expression Utilities", () => {
  it("canonicalizeExpression() works as expected", () => {
    expect(canonicalizeExpression("2 * 2", "")).toBe("2 * 2");
    expect(canonicalizeExpression("2 * 2", "foo")).toBe("(2 * 2)");
    expect(canonicalizeExpression("2 *", "foo")).toBe("2 *");
    expect(canonicalizeExpression("2 * foo", "foo")).toBe("(2 * __x__)");
    expect(canonicalizeExpression("2 * foo + foo", "foo")).toBe("((2 * __x__) + __x__)");
    expect(canonicalizeExpression("2 * foo bar", "foo bar")).toBe("(2 * __x__)");
    expect(canonicalizeExpression("2 * foo bar + foo bar", "foo bar")).toBe("((2 * __x__) + __x__)");
    expect(canonicalizeExpression("2 * foo*bar + foo*bar", "foo*bar")).toBe("((2 * __x__) + __x__)");
  });

  it("prettifyExpression() works as expected", () => {
    expect(prettifyExpression(undefined, "")).toBe(undefined);
    expect(prettifyExpression("2 * 2", "")).toBe("2 * 2");
    expect(prettifyExpression("2 * 2", "foo")).toBe("2 * 2");
    expect(prettifyExpression("2 * __x__", "foo")).toBe("2 * foo");
    expect(prettifyExpression("2 * __x__ + __x__", "foo")).toBe("2 * foo + foo");
    expect(prettifyExpression("2 * __x__", "foo bar")).toBe("2 * foo bar");
    expect(prettifyExpression("2 * __x__ + __x__", "foo bar")).toBe("2 * foo bar + foo bar");
    expect(prettifyExpression("2 * __x__ + __x__", "foo*bar")).toBe("2 * foo*bar + foo*bar");
  });

  it("validateExpression() returns error message for invalid expressions, undefined for valid expressions", () => {
    expect(validateExpression("", "")).toBe(undefined);
    expect(validateExpression("2", "")).toBe(undefined);
    expect(validateExpression("2", "")).toBe(undefined);
    expect(validateExpression("", "foo")).toBe(undefined);
    expect(validateExpression("2", "foo")).toBe(undefined);
    expect(validateExpression("2 *", "foo")).toContain("Could not");
    expect(validateExpression("2 * foo", "foo")).toBe(undefined);
    expect(validateExpression("foo", "bar")).toContain("Unrecognized");
  });
});
