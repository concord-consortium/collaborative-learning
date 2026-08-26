import "./dot-env.js";

/**
 * A small client for the two different ways the portal exposes its functionality.
 *
 * The portal has a JSON API under `/api/v1/` that accepts a bearer token, and a
 * server-rendered admin UI that does not. Some of the things a smoke-test setup needs —
 * creating an external report, attaching a report to a resource, editing an OAuth client —
 * exist only in the admin UI, so we have to drive its forms: fetch the page, read its CSRF
 * token, and post back with the session cookie. `PortalSession` handles both styles so
 * callers do not have to care which one a given operation happens to use.
 */

export type PortalName = "staging" | "production";

interface IPortalConfig {
  baseUrl: string;
  /** The .env key holding this portal's admin API token. */
  tokenEnvVar: string;
}

const portals: Record<PortalName, IPortalConfig> = {
  staging: {
    baseUrl: "https://learn.portal.staging.concord.org",
    tokenEnvVar: "PORTAL_STAGING_ACCESS_TOKEN"
  },
  production: {
    baseUrl: "https://learn.concord.org",
    tokenEnvVar: "PORTAL_ACCESS_TOKEN"
  }
};

export function isPortalName(name: string): name is PortalName {
  return name in portals;
}

export const portalNames = Object.keys(portals) as PortalName[];

/**
 * Thrown for any portal request that did not do what was asked. Carries the response body
 * so a caller reporting the failure can show what the portal actually said.
 */
export class PortalError extends Error {
  constructor(message: string, readonly status: number, readonly body: string) {
    super(`${message} (HTTP ${status})\n${body.slice(0, 500)}`);
    this.name = "PortalError";
  }
}

export class PortalSession {
  readonly baseUrl: string;
  private readonly token: string;
  /** name -> value. The admin UI's CSRF check needs the session cookie sent back. */
  private readonly cookies = new Map<string, string>();

  /**
   * When true, every request that could change portal state throws instead of being sent.
   *
   * This exists because "which calls write" is not obvious from their names: the portal's
   * only probe for "does an activity exist at this url" is `update_by_url`, a POST that
   * also *sets* fields. A caller reasoning about a dry run by inspecting call sites will
   * eventually miss one of those, so the session refuses the write itself rather than
   * relying on every caller to remember.
   */
  readOnly = false;

  constructor(readonly portalName: PortalName) {
    const config = portals[portalName];
    this.baseUrl = config.baseUrl;
    const token = process.env[config.tokenEnvVar];
    if (!token) {
      throw new Error(
        `Missing ${config.tokenEnvVar} in scripts/.env. ` +
        `See "Running scripts that connect with the portal" in scripts/README.md.`
      );
    }
    this.token = token;
  }

  url(path: string) {
    return `${this.baseUrl}/${path.replace(/^\//, "")}`;
  }

  private refuseIfReadOnly(method: string, path: string) {
    if (this.readOnly && method.toUpperCase() !== "GET") {
      throw new Error(
        `Read-only session refused ${method} ${path}. This is a bug: a dry run reached a ` +
        `call that changes portal state.`
      );
    }
  }

  private storeCookies(response: Response) {
    // getSetCookie is the only way to see every Set-Cookie header; a plain get()
    // folds them into one string that cannot be split reliably.
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const separator = pair.indexOf("=");
      if (separator > 0) {
        this.cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
      }
    }
  }

  private headers(extra: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      ...extra
    };
    if (this.cookies.size > 0) {
      headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    }
    return headers;
  }

  /** GET a page or endpoint and return its body as text. */
  async getText(path: string) {
    const response = await fetch(this.url(path), { headers: this.headers() });
    this.storeCookies(response);
    const body = await response.text();
    if (!response.ok) throw new PortalError(`GET ${path} failed`, response.status, body);
    return body;
  }

  /**
   * Call a `/api/v1/` endpoint. The portal signals failure two different ways — an HTTP
   * error status, or a 200 carrying `{success: false}` — so both are checked here rather
   * than at each call site.
   */
  async json<T = any>(path: string, init?: { method?: string; form?: Record<string, string> }): Promise<T> {
    const method = init?.method ?? "GET";
    this.refuseIfReadOnly(method, path);
    const body = init?.form ? new URLSearchParams(init.form).toString() : undefined;
    const response = await fetch(this.url(path), {
      method,
      headers: this.headers(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      body
    });
    this.storeCookies(response);
    const text = await response.text();
    if (!response.ok) throw new PortalError(`${method} ${path} failed`, response.status, text);
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new PortalError(`${method} ${path} did not return JSON`, response.status, text);
    }
    if (parsed && typeof parsed === "object" && "success" in parsed && !parsed.success) {
      throw new PortalError(`${method} ${path} was rejected: ${parsed.message ?? ""}`, response.status, text);
    }
    return parsed as T;
  }

  /**
   * Submit one of the admin UI's forms. `formPath` is the page holding the form — it is
   * fetched first for its CSRF token and session cookie, which Rails requires to accept the
   * post. `method: "put"` is tunnelled through `_method` the way Rails' own forms do it.
   */
  async submitForm(
    formPath: string,
    actionPath: string,
    fields: Record<string, string | string[]>,
    method: "post" | "put" = "post"
  ) {
    this.refuseIfReadOnly(method, actionPath);
    const formPage = await this.getText(formPath);
    const authenticityToken = findAuthenticityToken(formPage);
    if (!authenticityToken) {
      throw new Error(`No CSRF token found on ${formPath}; cannot submit ${actionPath}`);
    }

    const body = new URLSearchParams();
    body.append("authenticity_token", authenticityToken);
    if (method === "put") body.append("_method", "put");
    for (const [name, value] of Object.entries(fields)) {
      for (const item of Array.isArray(value) ? value : [value]) {
        body.append(name, item);
      }
    }

    const response = await fetch(this.url(actionPath), {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/x-www-form-urlencoded" }),
      body: body.toString(),
      // A successful admin form post answers with a redirect to the index. Following it
      // would cost a page load we never read, and would hide the status that tells us the
      // post was accepted.
      redirect: "manual"
    });
    this.storeCookies(response);
    // Rails re-renders the form with the errors on a validation failure, so a 200 here means
    // the save did NOT happen. Only a redirect means success.
    if (response.status < 300 || response.status >= 400) {
      const text = await response.text();
      throw new PortalError(`POST ${actionPath} was not accepted`, response.status, text);
    }
    return response.headers.get("location") ?? "";
  }
}

//
// HTML form parsing
//
// The admin UI is server-rendered, so reading current state means reading its forms. These
// helpers are deliberately narrow: they find one field by the `id` Rails generates
// (`<model>_<attribute>`), rather than trying to parse the page as a document.
//

function findAuthenticityToken(html: string) {
  return (
    html.match(/name="authenticity_token"[^>]*\bvalue="([^"]*)"/)?.[1] ??
    html.match(/\bvalue="([^"]*)"[^>]*name="authenticity_token"/)?.[1]
  );
}

/**
 * Rails escapes newlines inside a textarea as numeric character references (`&#x000A;`),
 * so a whitespace-separated field such as an OAuth client's redirect URIs arrives as one
 * unbroken line. Decoding those is what turns it back into separate entries; miss them and
 * the whole list looks like a single value.
 *
 * `&amp;` is decoded last so that an escaped entity (`&amp;#39;`) does not get decoded twice.
 */
function decodeEntities(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/** The `<input>` or `<textarea>` element with this Rails field id, as raw HTML. */
function findFieldTag(html: string, fieldId: string) {
  const inputTag = html.match(new RegExp(`<input\\b[^>]*\\bid="${fieldId}"[^>]*>`))?.[0];
  if (inputTag) return { tag: inputTag, type: "input" as const };
  const textareaMatch = html.match(new RegExp(`<textarea\\b[^>]*\\bid="${fieldId}"[^>]*>([\\s\\S]*?)</textarea>`));
  if (textareaMatch) return { tag: textareaMatch[0], type: "textarea" as const, content: textareaMatch[1] };
  return undefined;
}

/**
 * The current value of a form field. Textareas hold their value as content rather than an
 * attribute, and Rails emits a leading newline inside them that is not part of the value.
 */
export function readFormField(html: string, fieldId: string): string | undefined {
  const field = findFieldTag(html, fieldId);
  if (!field) return undefined;
  if (field.type === "textarea") return decodeEntities(field.content ?? "").replace(/^\n/, "");
  const value = field.tag.match(/\bvalue="([^"]*)"/)?.[1];
  return value === undefined ? undefined : decodeEntities(value);
}

/** Whether a checkbox field is currently checked. */
export function readFormCheckbox(html: string, fieldId: string) {
  const field = findFieldTag(html, fieldId);
  return field ? /\bchecked\b/.test(field.tag) : false;
}

/**
 * The selected value of a `<select>` field, or undefined when the field is absent or has no
 * option marked selected. Selects need their own reader because their value lives on a child
 * option rather than on the field itself — `readFormField` cannot see it.
 */
export function readFormSelect(html: string, fieldId: string) {
  const select = html.match(new RegExp(`<select\\b[^>]*\\bid="${fieldId}"[^>]*>([\\s\\S]*?)</select>`))?.[1];
  if (select === undefined) return undefined;
  const selected = select.match(/<option\b[^>]*\bselected\b[^>]*>/)?.[0];
  const value = selected?.match(/\bvalue="([^"]*)"/)?.[1];
  return value === undefined ? undefined : decodeEntities(value);
}

/** The values of every checked checkbox posting under `name`, e.g. `external_reports[]`. */
export function readCheckedValues(html: string, name: string) {
  const escapedName = name.replace(/[[\]]/g, "\\$&");
  const pattern = new RegExp(`<input\\b[^>]*\\bname="${escapedName}"[^>]*>`, "g");
  const values: string[] = [];
  for (const [tag] of html.matchAll(pattern)) {
    const value = tag.match(/\bvalue="([^"]*)"/)?.[1];
    if (value && /\bchecked\b/.test(tag)) values.push(value);
  }
  return values;
}

/** The ids appearing in `/<resource>/<id>` links on an admin index page, ascending. */
export function readAdminIndexIds(html: string, resourcePath: string) {
  const pattern = new RegExp(`/${resourcePath}/(\\d+)`, "g");
  const ids = new Set<number>();
  for (const [, id] of html.matchAll(pattern)) ids.add(Number(id));
  return [...ids].sort((a, b) => a - b);
}

/**
 * Every id across an admin index, following its pagination.
 *
 * Admin indexes are paginated, and reading only the first page silently misses records —
 * on the production portal the CLUE OAuth client sits on page 2, so a single-page scan
 * reports that no such client exists rather than failing loudly.
 *
 * Pages are followed until one yields no ids that were not already seen, which handles both
 * an empty page past the end and a last page that repeats entries.
 */
export async function collectAdminIndexIds(
  session: PortalSession, indexPath: string, resourcePath: string, maxPages = 20
) {
  const ids = new Set<number>();
  for (let page = 1; page <= maxPages; page++) {
    const separator = indexPath.includes("?") ? "&" : "?";
    const html = await session.getText(`${indexPath}${separator}page=${page}`);
    const fresh = readAdminIndexIds(html, resourcePath).filter(id => !ids.has(id));
    if (fresh.length === 0) break;
    fresh.forEach(id => ids.add(id));
  }
  return [...ids].sort((a, b) => a - b);
}
