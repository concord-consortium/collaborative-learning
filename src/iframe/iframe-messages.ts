// Messages this iframe posts to the page that embeds it.
//
// The embedding page sizes the iframe from the height in the "updateHeight" message, so that
// height has to be the height of the rendered document. `document.body.scrollHeight` cannot
// supply it. The body's only two children are a hidden `<svg>` of icons, which is positioned
// absolutely, and `#app`, which `src/components/app.scss` positions fixed and pins to all four
// edges of the viewport. Both are out of the normal flow, so the body has no in-flow content
// and its scrollHeight is 0. `#app` itself is no better on its own: pinned to the viewport, its
// height is the viewport's height, not the content's.
//
// The rules in components/document/unwrapped-document.scss put `#app` back in the normal flow in
// unwrapped mode and let the document content size it. Measuring `#app` then gives the content's
// height.

const contentElementId = "app";

/** Posts the height of the rendered document so the embedding page can size the iframe to fit. */
export function postContentHeight(target: Window, doc: Document): void {
  const content = doc.getElementById(contentElementId);
  if (!content) return;
  target.postMessage({ type: "updateHeight", height: content.scrollHeight }, "*");
}

let documentRenderedPosted = false;

/**
 * Posts a single "documentRendered" message once the document has been rendered for the first
 * time. A consumer that waits for this does not have to infer readiness from the height.
 */
export function postDocumentRendered(target: Window): void {
  if (documentRenderedPosted) return;
  documentRenderedPosted = true;
  target.postMessage({ type: "documentRendered" }, "*");
}
