/**
 * Readers for the portal's server-rendered admin UI.
 *
 * The admin UI has no JSON representation, so reading current state means reading its forms.
 * These helpers are deliberately narrow: they find one field by the `id` Rails generates
 * (`<model>_<attribute>`) rather than trying to parse the page as a document.
 *
 * They live apart from `portal-api.ts` because they are pure functions over a string, and so
 * are the one part of the portal client that can be tested without a portal — see
 * portal-html.test.ts. They are the part most worth testing, too: they are regexes against
 * markup that nothing in CI ever sees, so a change to the admin UI would be found by whoever
 * next runs a setup script against a real portal.
 */

export function findAuthenticityToken(html: string) {
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
 * The current value of a form field, or undefined when the page has no such field.
 *
 * Callers must keep those two apart rather than folding a miss into "": for a field that is
 * rewritten whole, such as an OAuth client's shared redirect URIs, an unreadable field and an
 * empty one call for opposite actions.
 *
 * Textareas hold their value as content rather than an attribute, and Rails emits a leading
 * newline inside them that is not part of the value.
 */
export function readFormField(html: string, fieldId: string): string | undefined {
  const field = findFieldTag(html, fieldId);
  if (!field) return undefined;
  if (field.type === "textarea") return decodeEntities(field.content ?? "").replace(/^\n/, "");
  const value = field.tag.match(/\bvalue="([^"]*)"/)?.[1];
  return value === undefined ? undefined : decodeEntities(value);
}

/**
 * Whether a checkbox field is currently checked.
 *
 * Rails' `check_box` marks a checked box as `checked="checked"`, which is what this looks
 * for. The word boundary would also match the `checked` inside `aria-checked`, so keep the
 * attribute name in mind if the admin UI ever grows one on these inputs.
 */
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
