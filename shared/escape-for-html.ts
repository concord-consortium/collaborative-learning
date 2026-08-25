/**
 * Makes a JSON string safe to place inside a <script> element.
 *
 * HTML ends a script element at the first `</script>` it sees, even one inside a JavaScript
 * string, so a document containing that text would otherwise break out of the script and inject
 * markup into the page. Escaping `<` and `>` makes that impossible, and also prevents `<!--`
 * from starting a comment. `&` is escaped so the result is still read correctly if the page is
 * ever parsed as XHTML. U+2028 and U+2029 are legal inside a JSON string but are line
 * terminators in JavaScript source, where an unescaped one is a syntax error.
 *
 * All five escapes are JSON string escapes, so `JSON.parse` reads the result back to the
 * identical value.
 */
export function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    // Written as regex escapes rather than literal characters: an invisible line separator
    // in source would be impossible to review and easy to delete by accident.
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Escapes a value for use inside a double-quoted HTML attribute. */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
