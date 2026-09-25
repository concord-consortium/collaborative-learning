/**
 * The portal OAuth client CLUE logs in through, shared by the scripts that set up CLUE on a
 * portal (setup-portal-assignment.ts, update-portal-release.ts).
 */

import { PortalSession, collectAdminIndexIds, readFormField } from "./portal-api.js";

/** The `app_id` of the portal OAuth client CLUE authenticates against (OAUTH_CLIENT_NAME). */
export const kClueOAuthAppId = "clue";

/** The portal OAuth client with this app_id. */
export async function findOAuthClientId(portal: PortalSession, appId: string, maxPages = 20) {
  const ids = await collectAdminIndexIds(portal, "/admin/clients", "admin/clients", maxPages);
  for (const id of ids) {
    const page = await portal.getText(`/admin/clients/${id}/edit`);
    if (readFormField(page, "client_app_id") === appId) return id;
  }
  throw new Error(
    `No portal OAuth client found with app_id "${appId}" (searched ${ids.length} clients). ` +
    `Pass --oauth-client-id to name it directly.`
  );
}

/**
 * Confirm a caller-supplied client id really is the CLUE client.
 *
 * `--oauth-client-id` skips `findOAuthClientId`, which is the only thing that reads app_id,
 * and parsing proves nothing beyond "a positive integer". Every id in this range names a
 * real, shared OAuth client, so an adjacent typo does not 404 — it names somebody else's
 * client, which would then get a CLUE redirect URI appended to its list and a report bound
 * to it. Cheap to check: this is the same page ensureRedirectUri already fetches.
 */
export async function verifyOAuthClientId(portal: PortalSession, clientId: number, appId: string) {
  const page = await portal.getText(`/admin/clients/${clientId}/edit`);
  const actual = readFormField(page, "client_app_id");
  if (actual !== appId) {
    const found = actual === undefined ? "no app_id field" : `app_id "${actual}"`;
    throw new Error(
      `--oauth-client-id ${clientId} has ${found}, not app_id "${appId}". That is a ` +
      `different OAuth client; adding CLUE's redirect URI to it would be wrong.`
    );
  }
  return clientId;
}

/**
 * Add a redirect URI to an OAuth client if it isn't there already. The list is shared by every
 * CLUE deployment and stored as one field, so this only ever appends, and verifies afterwards
 * that nothing else was dropped.
 */
export async function ensureRedirectUri(
  portal: PortalSession, clientId: number, redirectUri: string, dryRun: boolean
) {
  const editPage = await portal.getText(`/admin/clients/${clientId}/edit`);
  const current = readFormField(editPage, "client_redirect_uris");
  // "field not found" and "field is empty" must not collapse into each other. They differ by
  // one `?? ""`, and the consequences are opposite: an empty field is appended to safely,
  // while an unparsed one — a renamed field id, a changed admin page — would make the write
  // below replace every other deployment's redirect URI with this run's single entry.
  if (current === undefined) {
    throw new Error(
      `Could not find the redirect URIs field (client_redirect_uris) on the OAuth client's ` +
      `edit page. Refusing to write: an unreadable field is indistinguishable from an empty ` +
      `one, and writing would replace the whole shared list.`
    );
  }
  const currentUris = current.split(/\s+/).filter(Boolean);

  // This client is shared by every CLUE deployment, and the field is rewritten whole. If the
  // page parsed into something that does not look like a list of URIs, the safe assumption is
  // that the parser is wrong rather than that the client really holds one odd value — writing
  // on that assumption would replace everyone else's URIs with a single corrupted entry.
  if (current.trim() && !currentUris.every(uri => /^https?:\/\//.test(uri))) {
    throw new Error(
      `Could not parse the OAuth client's redirect URIs into a list ` +
      `(got ${currentUris.length} entr${currentUris.length === 1 ? "y" : "ies"}, ` +
      `first: "${currentUris[0]?.slice(0, 80)}"). Refusing to overwrite the field.`
    );
  }

  if (currentUris.includes(redirectUri)) return { changed: false, count: currentUris.length };
  if (dryRun) return { changed: true, count: currentUris.length + 1 };

  // redirect_uris is one whitespace-separated field, so adding an entry means resending the
  // whole list. Append rather than rebuild: this client is shared, and dropping somebody
  // else's URI would break their deployment with no obvious cause.
  const updated = `${current.replace(/\s*$/, "")}\n${redirectUri}\n`;
  await portal.submitForm(
    `/admin/clients/${clientId}/edit`,
    `/admin/clients/${clientId}`,
    { "client[redirect_uris]": updated },
    "put"
  );

  const verifyPage = await portal.getText(`/admin/clients/${clientId}/edit`);
  const after = (readFormField(verifyPage, "client_redirect_uris") ?? "").split(/\s+/).filter(Boolean);
  const dropped = current.split(/\s+/).filter(Boolean).filter(uri => !after.includes(uri));
  if (dropped.length > 0) {
    throw new Error(`Updating the OAuth client dropped existing redirect URIs: ${dropped.join(", ")}`);
  }
  if (!after.includes(redirectUri)) throw new Error("The redirect URI was not saved");
  return { changed: true, count: after.length };
}
