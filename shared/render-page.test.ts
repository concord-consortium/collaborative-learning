import {
  generateRenderHtml, iframeUrlFor, isClueFrameUrl, kInitialFrameHeightPx, kMaxFrameHeightPx
} from "./render-page";

/**
 * A document whose student text does every dangerous thing at once: closes the script element,
 * carries quotes and ampersands, and contains the two Unicode line separators that are legal in JSON
 * and are line terminators in JavaScript source.
 */
const adversarialDocument = {
  rowOrder: ["row-1"],
  rowMap: { "row-1": { id: "row-1", isSectionHeader: false, tiles: [{ tileId: "text-tile" }] } },
  tileMap: {
    "text-tile": {
      id: "text-tile",
      content: {
        type: "Text",
        format: "markdown",
        text: "</script><img src=x onerror=alert(1)> \"quoted\" 'single' A & B <b>bold</b>" +
          " line\u2028separator paragraph\u2029separator" +
          // A student who literally types the escape sequence, plus a lone backslash: JSON.stringify
          // doubles the backslash, and the escaping here must leave that alone rather than compound it.
          " backslash \\u003c and \\ alone"
      }
    }
  }
};

describe("the iframe URL", () => {
  it("carries the unit, unwrapped and readOnly", () => {
    expect(iframeUrlFor("http://localhost:8080", "qa"))
      .toBe("http://localhost:8080/iframe.html?unit=qa&unwrapped&readOnly");
  });

  it("uses a clueUrl that already names an .html page as the page itself", () => {
    expect(iframeUrlFor("https://collaborative-learning.concord.org/authoring-iframe/index.html", "mods"))
      .toBe("https://collaborative-learning.concord.org/authoring-iframe/index.html?unit=mods&unwrapped&readOnly");
  });

  it("percent-encodes a unit given as a URL", () => {
    expect(iframeUrlFor("http://localhost:8080/", "http://127.0.0.1:5000/content.json"))
      .toBe("http://localhost:8080/iframe.html?unit=http%3A%2F%2F127.0.0.1%3A5000%2Fcontent.json" +
        "&unwrapped&readOnly");
  });
});

describe("recognizing the CLUE frame", () => {
  it("matches both the build-root and the released iframe pages", () => {
    expect(isClueFrameUrl("http://localhost:8080/iframe.html?unit=qa&unwrapped&readOnly")).toBe(true);
    expect(isClueFrameUrl(
      "https://collaborative-learning.concord.org/authoring-iframe/index.html?unit=mods&unwrapped&readOnly"
    )).toBe(true);
    expect(isClueFrameUrl("https://collaborative-learning.concord.org/branch/master/iframe.html")).toBe(true);
  });

  it("does not match the render page or other CLUE entry points", () => {
    expect(isClueFrameUrl("about:blank")).toBe(false);
    expect(isClueFrameUrl("http://127.0.0.1:5000/render.html")).toBe(false);
    expect(isClueFrameUrl("https://collaborative-learning.concord.org/index.html")).toBe(false);
  });
});

describe("the generated render page", () => {
  const html = generateRenderHtml({
    content: adversarialDocument, clueUrl: "http://localhost:8080", unit: "harness-render"
  });

  it("contains no unescaped closing script tag from the document", () => {
    // The whole point: interpolated straight in, this string closes the element and injects markup
    // into the page. Every caller of this generator gets the escaping, so none of them can.
    expect(html).not.toContain("</script><img");
    expect(html).toContain("\\u003c/script\\u003e");
    // Exactly the two script elements the page defines, and no more.
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });

  it("puts the escaped document where the page can read it back", () => {
    const match = html.match(/const initialValue=(.*)<\/script>/);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toEqual(adversarialDocument);
  });

  it("loads the iframe unwrapped and read-only, with the unit", () => {
    expect(html).toContain('src="http://localhost:8080/iframe.html?unit=harness-render&amp;unwrapped&amp;readOnly"');
  });

  it("matches its snapshot", () => {
    expect(html).toMatchSnapshot();
  });

  it("clamps the frame to the ceiling by default", () => {
    expect(html).toContain(`Math.min(height, ${kMaxFrameHeightPx})`);
  });

  it("honors a custom maxHeightPx", () => {
    const custom = generateRenderHtml({
      content: adversarialDocument, clueUrl: "http://localhost:8080", unit: "harness-render",
      maxHeightPx: 1234
    });
    expect(custom).toContain("Math.min(height, 1234)");
    expect(custom).not.toContain(`Math.min(height, ${kMaxFrameHeightPx})`);
  });
});

/**
 * Runs the page's own height-update listener — extracted from the real generated HTML, not
 * reimplemented — against a real `<iframe id="clue-frame">` in this test's DOM.
 *
 * The listener only attaches once `sendInitialValueToEditor` runs on `load`, and that function
 * returns early if `contentWindow` is falsy. jsdom gives even a bare, src-less iframe a real
 * (about:blank) `contentWindow`, so dispatching `load` here exercises that guard correctly.
 */
function frameAfterListenerSetup(html: string): HTMLIFrameElement {
  const iframeMarkup = html.match(/<iframe[^]*?<\/iframe>/)![0];
  const script = html.match(/<script>\s*const clueFrame[^]*?<\/script>/)![0]
    .replace(/^<script>/, "").replace(/<\/script>$/, "");
  document.body.innerHTML = iframeMarkup;
  const frame = document.getElementById("clue-frame") as HTMLIFrameElement;
  expect(frame.contentWindow).toBeTruthy();
  // eslint-disable-next-line no-new-func -- runs the page's real script text, not a copy of it.
  new Function("initialValue", script)({});
  frame.dispatchEvent(new Event("load"));
  return frame;
}

function sendHeightUpdate(height: unknown): void {
  window.dispatchEvent(new MessageEvent("message", {data: {type: "updateHeight", height}}));
}

describe("the height-update listener the generated page actually runs", () => {
  const html = generateRenderHtml({
    content: adversarialDocument, clueUrl: "http://localhost:8080", unit: "harness-render"
  });

  it("starts the frame at its initial height, before any message arrives", () => {
    const frame = frameAfterListenerSetup(html);
    expect(frame.height).toBe(`${kInitialFrameHeightPx}px`);
  });

  it("grows the frame to an ordinary height", () => {
    const frame = frameAfterListenerSetup(html);
    sendHeightUpdate(1200);
    expect(frame.height).toBe("1200px");
  });

  it("clamps a height past the default ceiling", () => {
    const frame = frameAfterListenerSetup(html);
    sendHeightUpdate(kMaxFrameHeightPx + 500);
    expect(frame.height).toBe(`${kMaxFrameHeightPx}px`);
  });

  it("clamps to a custom maxHeightPx instead of the default ceiling", () => {
    const custom = generateRenderHtml({
      content: adversarialDocument, clueUrl: "http://localhost:8080", unit: "harness-render",
      maxHeightPx: 1234
    });
    const frame = frameAfterListenerSetup(custom);
    sendHeightUpdate(5000);
    expect(frame.height).toBe("1234px");
  });

  it.each([0, -10, NaN, "not-a-number", undefined, null])(
    "ignores an invalid height (%p) and leaves the frame at its previous height", (invalid) => {
      const frame = frameAfterListenerSetup(html);
      sendHeightUpdate(1500);
      expect(frame.height).toBe("1500px");
      sendHeightUpdate(invalid);
      expect(frame.height).toBe("1500px");
    });

  it("ignores a message that is not an updateHeight message", () => {
    const frame = frameAfterListenerSetup(html);
    window.dispatchEvent(new MessageEvent("message", {data: {type: "somethingElse", height: 1200}}));
    expect(frame.height).toBe(`${kInitialFrameHeightPx}px`);
  });
});
