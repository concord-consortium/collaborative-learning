import { canonicalUserId } from "./canonical-user-id";

describe("canonicalUserId", () => {
  // The portal's own identifier, passed through rather than rebuilt. Using the platform's string
  // means anyone correlating a tutor backend's records with portal records later needs no
  // translation table.
  it("uses the portal's canonical user url when the launch has one", () => {
    expect(canonicalUserId({
      appMode: "authed", userId: "101", rootId: "learn_concord_org",
      portalHost: "learn.concord.org",
      portalUserUrl: "https://learn.concord.org/users/101",
    })).toBe("https://learn.concord.org/users/101");
  });

  // An authed launch whose JWT lacks the field still has a real portal, so it is reconstructed
  // from the host rather than filed under an invented one — which would put a real student in the
  // same namespace as demo traffic.
  it("reconstructs from the portal host when the url is absent", () => {
    expect(canonicalUserId({
      appMode: "authed", userId: "101", rootId: "learn_concord_org",
      portalHost: "learn.concord.org",
    })).toBe("https://learn.concord.org/users/101");
  });

  // The whole point of not sending the bare platform id: two portals both number a student 101.
  it("distinguishes the same platform id on different portals", () => {
    const a = canonicalUserId({
      appMode: "authed", userId: "101", rootId: "a", portalHost: "learn.concord.org" });
    const b = canonicalUserId({
      appMode: "authed", userId: "101", rootId: "b", portalHost: "portal.example.org" });
    expect(a).not.toBe(b);
  });

  // Unauthed launches have no portal, so they get an address in a namespace we own — carrying the
  // same partition CLUE itself roots documents under, because that partition is what makes two
  // users distinct. For demo that is the demo name.
  it("keeps demo users apart by demo name", () => {
    const one = canonicalUserId({ appMode: "demo", userId: "1", rootId: "classA" });
    const two = canonicalUserId({ appMode: "demo", userId: "1", rootId: "classB" });
    expect(one).toBe("https://demo.clue.concord.org/classA/users/1");
    expect(one).not.toBe(two);
  });

  it.each(["demo", "qa", "dev", "test"])("gives %s launches their own namespace", (appMode) => {
    expect(canonicalUserId({ appMode, userId: "1", rootId: "r" }))
      .toBe(`https://${appMode}.clue.concord.org/r/users/1`);
  });

  // Same root id in two appModes is still two users; the appMode is part of CLUE's own path too.
  it("keeps the appModes apart even when their root ids coincide", () => {
    const qa = canonicalUserId({ appMode: "qa", userId: "1", rootId: "same" });
    const demo = canonicalUserId({ appMode: "demo", userId: "1", rootId: "same" });
    expect(qa).not.toBe(demo);
  });

  // A demo name is author-supplied and need not be url-safe. Encoding it keeps a name with a
  // space or a slash from silently becoming a different address than intended.
  it("encodes a root id that is not url-safe", () => {
    expect(canonicalUserId({ appMode: "demo", userId: "1", rootId: "my class/2" }))
      .toBe("https://demo.clue.concord.org/my%20class%2F2/users/1");
  });

  it("omits the segment entirely when there is no root id", () => {
    expect(canonicalUserId({ appMode: "dev", userId: "1", rootId: "" }))
      .toBe("https://dev.clue.concord.org/users/1");
  });

  // An empty string is not a url, and passing one through would hand a backend a blank identity
  // that every such user would share.
  it("ignores an empty portal url rather than passing it through", () => {
    expect(canonicalUserId({
      appMode: "authed", userId: "101", rootId: "x", portalHost: "learn.concord.org",
      portalUserUrl: "",
    })).toBe("https://learn.concord.org/users/101");
  });
});
