/**
 * The render page: a document embedded in a script element plus an iframe that loads CLUE and is
 * handed that document.
 *
 * There is exactly one generator, shared by all three modes. The two prior-art copies and production
 * itself each interpolate `JSON.stringify(content)` straight into a `<script>` element, so a student
 * whose text contains `</script>` ends the element early and injects markup into the render page.
 * This copy escapes instead. (Production's copy needs the same fix; that is a production change —
 * see "Findings for elsewhere" in the milestone-2 spec.)
 */

/**
 * Makes a JSON string safe to sit inside a `<script>` element.
 *
 * `<` and `>` are escaped so no character sequence can close the element or open a comment; `&` goes
 * with them so the result cannot be misread if the page is ever parsed as XHTML. U+2028 and U+2029
 * are valid in JSON strings but are line terminators in JavaScript source, so an unescaped one is a
 * syntax error rather than a security problem — either way the page stops working.
 */
export function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    // Written as regex escapes rather than literal characters: an invisible line separator in
    // this source would be impossible to review and easy to delete by accident.
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

export interface RenderHtmlOptions {
  /** The document content, as an object — not a string of JSON. */
  content: unknown;
  /** The CLUE deployment to render through, without a trailing slash. */
  clueUrl: string;
  /**
   * The unit to load. Tile types are registered from the *unit's* configuration, so omitting this
   * would load CLUE's default unit and quietly render most tiles as "unknown tile" — a perfectly
   * valid PNG of the wrong thing.
   */
  unit: string;
  /** Starting height of the iframe before the first `updateHeight` message arrives. */
  initialHeightPx?: number;
}

/**
 * Builds the iframe URL. `unit` is percent-encoded because it may be a full URL to a `content.json`,
 * which contains characters that would otherwise end the query parameter.
 */
export function iframeUrlFor(clueUrl: string, unit: string): string {
  const base = clueUrl.replace(/\/+$/, "");
  return `${base}/iframe.html?unit=${encodeURIComponent(unit)}&unwrapped&readOnly`;
}

/**
 * The same page production posts to Shutterbug, with the injection hole closed and one addition: the
 * page records on `window` that it handed the document to the iframe, which is the one thing a local
 * capture cannot observe from outside. Readiness itself is measured inside the CLUE frame — the
 * `updateHeight` message reports 0 in this build — so nothing else is recorded here. Shutterbug
 * ignores it either way.
 */
export function generateRenderHtml(options: RenderHtmlOptions): string {
  const { content, clueUrl, unit, initialHeightPx = 500 } = options;
  const serialized = escapeJsonForScript(JSON.stringify(content));
  const source = escapeHtmlAttribute(iframeUrlFor(clueUrl, unit));
  return `
    <script>const initialValue=${serialized}</script>
    <!-- height will be updated when iframe sends updateHeight message -->
    <iframe id='clue-frame' width='100%' height='${initialHeightPx}px' style='border:0px'
      allow='serial'
      src="${source}"
    ></iframe>
    <script>
      const clueFrame = document.getElementById('clue-frame')
      window.__clueRender = { initialValuePosted: false }
      function sendInitialValueToEditor() {
        if (!clueFrame.contentWindow) {
          console.warn("iframe doesn't have contentWindow");
          return;
        }
        window.addEventListener("message", (event) => {
          // Kept for parity with production's page, which sizes the frame from this message.
          if (event.data && event.data.type === "updateHeight") {
            const height = Number(event.data.height);
            if (!Number.isFinite(height) || height <= 0) return;
            document.getElementById("clue-frame").height = height + "px";
          }
        })
        clueFrame.contentWindow.postMessage(
          { initialValue: JSON.stringify(initialValue) },
          "*"
        );
        window.__clueRender.initialValuePosted = true;
      }
      clueFrame.addEventListener('load', sendInitialValueToEditor);
    </script>
  `;
}
