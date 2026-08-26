/**
 * The render page: a document embedded in a script element plus an iframe that loads CLUE and is
 * handed that document.
 *
 * There is exactly one generator, shared by all three modes. The two prior-art copies and production
 * itself each interpolate `JSON.stringify(content)` straight into a `<script>` element, so a student
 * whose text contains `</script>` ends the element early and injects markup into the render page.
 * This copy escapes instead. Production's copy needs the same fix, which is a production change
 * rather than a harness one.
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

/**
 * The height the iframe starts at, before anything resizes it.
 *
 * Exported because `puppeteer.ts` compares against it to decide whether the frame needs growing to
 * cover the document. Two independent literals would silently uncouple: the resize guard would stop
 * firing and a viewport-sized capture would be recorded as a full-document one.
 */
export const kInitialFrameHeightPx = 500;

export interface RenderHtmlOptions {
  /** The document content, as an object — not a string of JSON. */
  content: unknown;
  /** The CLUE build root (or an `.html` iframe page) to render through, without a trailing slash. */
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
 *
 * `clueUrl` is normally a CLUE build root, and `iframe.html` is appended. The released build has no
 * top-level `iframe.html` — the release workflow copies only a few entry points to the top level —
 * so production reaches the same page through `authoring-iframe/index.html`. A `clueUrl` that
 * already names an `.html` page is therefore used as it is.
 */
export function iframeUrlFor(clueUrl: string, unit: string): string {
  const base = clueUrl.replace(/\/+$/, "");
  const page = /\.html$/.test(base) ? base : `${base}/iframe.html`;
  return `${page}?unit=${encodeURIComponent(unit)}&unwrapped&readOnly`;
}

/**
 * Whether a frame URL is the CLUE document iframe built by `iframeUrlFor`: `iframe.html` on a build
 * root, or the released build's `authoring-iframe/index.html`.
 */
export function isClueFrameUrl(url: string): boolean {
  return /\/(iframe\.html|authoring-iframe\/index\.html)(\?|$)/.test(url);
}

/**
 * The same page production posts to Shutterbug, with the injection hole closed and one addition: the
 * page records on `window` that it handed the document to the iframe, which is the one thing a local
 * capture cannot observe from outside. Readiness itself is measured inside the CLUE frame — the
 * `updateHeight` message reports 0 in this build — so nothing else is recorded here. Shutterbug
 * ignores it either way.
 */
export function generateRenderHtml(options: RenderHtmlOptions): string {
  const { content, clueUrl, unit, initialHeightPx = kInitialFrameHeightPx } = options;
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
          // Production assigns this unconditionally, so a height of 0 collapses its iframe to
          // "0px". Guarded here because the local mode sizes the frame itself after settling and a
          // late zero would wipe the capture. See the README on what parity does and does not cover.
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
