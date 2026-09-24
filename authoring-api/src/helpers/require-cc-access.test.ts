import {Response} from "express";
import {AuthorizedRequest} from "./express";
import {isCCEmail, requireCCAccess} from "./require-cc-access";

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.setHeader = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
}

function requestWithEmail(email?: string): AuthorizedRequest {
  return {decodedToken: {email}} as AuthorizedRequest;
}

describe("isCCEmail", () => {
  it("accepts any concord.org address", () => {
    expect(isCCEmail("someone@concord.org")).toBe(true);
  });

  it("accepts the other listed CC addresses", () => {
    expect(isCCEmail("doug@zoopdoop.com")).toBe(true);
  });

  it("rejects an unrelated address", () => {
    expect(isCCEmail("someone@example.com")).toBe(false);
  });
});

describe("requireCCAccess", () => {
  it("lets a CC email through", () => {
    const res = mockResponse();
    const next = jest.fn();

    requireCCAccess(requestWithEmail("someone@concord.org"), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  // The frontend's shared apiFetch helper (use-authoring-api.tsx) reads the body of a failed
  // response as JSON to show the real reason to the user; a plain-text body makes that parse
  // fail and falls back to a generic "status 403" message instead.
  it("rejects a non-CC email with a JSON body, not plain text, and an accurate message", () => {
    const res = mockResponse();
    const next = jest.fn();

    requireCCAccess(requestWithEmail("someone@example.com"), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith(
      {success: false, error: "Only Concord Consortium staff can use this action."}
    );
  });

  it("rejects a request with no email the same way", () => {
    const res = mockResponse();
    const next = jest.fn();

    requireCCAccess(requestWithEmail(undefined), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
