import type { PortalSession } from "./portal-api";
import { ensureRedirectUri } from "./portal-oauth";

// portal-oauth imports "./portal-api.js", a specifier the root jest config doesn't map to the .ts
// source, and the real module loads the scripts' .env. The functions it needs are pure.
jest.mock("./portal-api.js", () => {
  const { readFormField } = jest.requireActual("./portal-html");
  return { readFormField, collectAdminIndexIds: jest.fn() };
}, { virtual: true });

const kClientId = 6;
const kUri = "https://collaborative-learning.concord.org/version/v7.7.0/";

/**
 * A stand-in for the portal's OAuth client edit page. `redirectUris` is the textarea's content, or
 * undefined for a page without the field. `save` decides what the portal stores from a submitted
 * list, so a portal that loses entries can be simulated.
 */
function fakePortal(redirectUris: string | undefined, save = (submitted: string) => submitted) {
  const state = { redirectUris, writes: [] as Record<string, string>[] };
  const portal = {
    async getText(path: string) {
      expect(path).toBe(`/admin/clients/${kClientId}/edit`);
      if (state.redirectUris === undefined) return "<form></form>";
      return `<textarea name="client[redirect_uris]" id="client_redirect_uris">\n${state.redirectUris}</textarea>`;
    },
    async submitForm(editPath: string, updatePath: string, fields: Record<string, string>, method: string) {
      expect([editPath, updatePath, method])
        .toEqual([`/admin/clients/${kClientId}/edit`, `/admin/clients/${kClientId}`, "put"]);
      state.writes.push(fields);
      state.redirectUris = save(fields["client[redirect_uris]"]);
    }
  };
  return { portal: portal as unknown as PortalSession, state };
}

describe("ensureRedirectUri", () => {
  const existing = "https://collaborative-learning.concord.org/version/v7.6.0/\nhttps://other.concord.org/\n";

  it("appends the URI and keeps every existing entry", async () => {
    const { portal, state } = fakePortal(existing);
    await expect(ensureRedirectUri(portal, kClientId, kUri, false)).resolves.toEqual({ changed: true, count: 3 });
    expect(state.writes).toEqual([{ "client[redirect_uris]": `${existing.trimEnd()}\n${kUri}\n` }]);
  });

  it("appends to an empty list", async () => {
    const { portal, state } = fakePortal("");
    await expect(ensureRedirectUri(portal, kClientId, kUri, false)).resolves.toEqual({ changed: true, count: 1 });
    expect(state.redirectUris?.trim()).toBe(kUri);
  });

  it("writes nothing when the URI is already present", async () => {
    const { portal, state } = fakePortal(`${existing}${kUri}\n`);
    await expect(ensureRedirectUri(portal, kClientId, kUri, false)).resolves.toEqual({ changed: false, count: 3 });
    expect(state.writes).toEqual([]);
  });

  it("writes nothing on a dry run", async () => {
    const { portal, state } = fakePortal(existing);
    await expect(ensureRedirectUri(portal, kClientId, kUri, true)).resolves.toEqual({ changed: true, count: 3 });
    expect(state.writes).toEqual([]);
  });

  it("refuses a URI that isn't an http(s) URL", async () => {
    const { portal, state } = fakePortal(existing);
    await expect(ensureRedirectUri(portal, kClientId, "collaborative-learning.concord.org/v7.7.0/", false))
      .rejects.toThrow(/isn't an http\(s\) URL/);
    expect(state.writes).toEqual([]);
  });

  it("refuses to write when the field can't be found, rather than treating it as empty", async () => {
    const { portal, state } = fakePortal(undefined);
    await expect(ensureRedirectUri(portal, kClientId, kUri, false))
      .rejects.toThrow(/Could not find the redirect URIs field/);
    expect(state.writes).toEqual([]);
  });

  it("refuses to write when the field doesn't parse into a list of URLs", async () => {
    const { portal, state } = fakePortal(`${existing}<b>not a url</b>\n`);
    await expect(ensureRedirectUri(portal, kClientId, kUri, false)).rejects.toThrow(/Could not parse/);
    expect(state.writes).toEqual([]);
  });

  it("reports existing entries the portal dropped", async () => {
    const { portal } = fakePortal(existing, () => `${kUri}\n`);
    await expect(ensureRedirectUri(portal, kClientId, kUri, false)).rejects.toThrow(/dropped existing redirect URIs/);
  });

  it("reports a URI the portal didn't save", async () => {
    const { portal } = fakePortal(existing, () => existing);
    await expect(ensureRedirectUri(portal, kClientId, kUri, false)).rejects.toThrow(/was not saved/);
  });
});
