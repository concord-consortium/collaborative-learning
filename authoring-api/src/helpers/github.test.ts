import {describeGitHubError} from "./github";

describe("describeGitHubError", () => {
  const fallback = "An error occurred while renaming the image.";

  it("maps GitHub auth failures (401/403) to an actionable re-auth message", () => {
    for (const status of [401, 403]) {
      const {message, statusCode} = describeGitHubError({status}, fallback);
      expect(message).toMatch(/authenticate with GitHub/i);
      expect(statusCode).toBe(502);
    }
  });

  it("maps 404 to a not-found message", () => {
    const {message, statusCode} = describeGitHubError({status: 404}, fallback);
    expect(message).toMatch(/not be found on GitHub|not found on GitHub/i);
    expect(statusCode).toBe(404);
  });

  it("maps ref conflicts (409/422) to a retry message", () => {
    for (const status of [409, 422]) {
      const {message, statusCode} = describeGitHubError({status}, fallback);
      expect(message).toMatch(/retry/i);
      expect(statusCode).toBe(409);
    }
  });

  it("falls back to the caller's generic message for unknown/unexpected errors", () => {
    expect(describeGitHubError(new Error("boom"), fallback)).toEqual({message: fallback, statusCode: 500});
    expect(describeGitHubError({status: 500}, fallback)).toEqual({message: fallback, statusCode: 500});
    expect(describeGitHubError(undefined, fallback)).toEqual({message: fallback, statusCode: 500});
    // A non-numeric status must not be treated as a known case.
    expect(describeGitHubError({status: "401"}, fallback)).toEqual({message: fallback, statusCode: 500});
  });
});
