/**
 * The render page: a document embedded in a script element plus an iframe that loads CLUE and is
 * handed that document.
 *
 * There is exactly one generator. The AI analysis pipeline
 * (`functions-v2/src/on-analysis-document-pending.ts`), the harness's render modes and the
 * `scripts/shutterbug.ts` dev script all build their page here, so the only thing that differs
 * between them is the CLUE build and unit they point at.
 *
 * The document is escaped on the way into the `<script>` element: a student whose text contains
 * `</script>` would otherwise end the element early and inject markup into the page.
 */
import { escapeHtmlAttribute, escapeJsonForScript } from "./escape-for-html";

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
 * Builds the page.
 *
 * It records on `window` that it handed the document to the iframe, which is the one thing a local
 * capture cannot observe from outside; the harness's puppeteer mode waits on that. Readiness itself
 * is measured inside the CLUE frame, so nothing else is recorded here. Shutterbug and the analysis
 * pipeline ignore the marker.
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
          // A height of 0, or anything that is not a positive number, would collapse the iframe
          // and hide the document the picture is meant to show. Ignoring it leaves the iframe at
          // its starting height.
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
