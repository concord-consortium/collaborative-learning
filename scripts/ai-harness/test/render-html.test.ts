import {
  escapeHtmlAttribute, escapeJsonForScript, generateRenderHtml, iframeUrlFor
} from "../src/backends/render-html.js";

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

describe("escaping a document into a script element", () => {
  it("escapes the characters that could end the element", () => {
    expect(escapeJsonForScript('"</script>"')).toBe('"\\u003c/script\\u003e"');
  });

  it("escapes ampersands", () => {
    expect(escapeJsonForScript('"A & B"')).toBe('"A \\u0026 B"');
  });

  it("escapes the two Unicode line terminators", () => {
    expect(escapeJsonForScript('"a\u2028b\u2029c"')).toBe('"a\\u2028b\\u2029c"');
  });

  it("still parses back to the original document", () => {
    // The escaping has to be reversible. Every sequence it writes is a valid JSON string escape, so
    // the page reads back exactly the student text — mangling that would change what the model is
    // shown, which is the one thing the harness must not do.
    const escaped = escapeJsonForScript(JSON.stringify(adversarialDocument));
    expect(JSON.parse(escaped)).toEqual(adversarialDocument);
  });
});

describe("escaping an attribute", () => {
  it("escapes quotes, angle brackets and ampersands", () => {
    expect(escapeHtmlAttribute(`a"b<c>d&e'f`)).toBe("a&quot;b&lt;c&gt;d&amp;e&#39;f");
  });
});

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

describe("the generated render page", () => {
  const html = generateRenderHtml({
    content: adversarialDocument, clueUrl: "http://localhost:8080", unit: "harness-render"
  });

  it("contains no unescaped closing script tag from the document", () => {
    // The whole point: production and both prior-art copies interpolate JSON.stringify(content)
    // straight in, so this string would close the element and inject markup into the render page.
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
});
