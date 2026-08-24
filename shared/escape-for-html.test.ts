import { escapeHtmlAttribute, escapeJsonForScript } from "./escape-for-html";

describe("escapeJsonForScript", () => {
  it("removes the characters that could close the script element", () => {
    const original = { text: "</script><img src=x onerror=alert(1)>" };
    const escaped = escapeJsonForScript(JSON.stringify(original));
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
    expect(JSON.parse(escaped)).toEqual(original);
  });

  it("escapes the JavaScript line terminators that are legal in JSON", () => {
    const original = { text: "line\u2028separator\u2029paragraph" };
    const escaped = escapeJsonForScript(JSON.stringify(original));
    expect(escaped).not.toContain("\u2028");
    expect(escaped).not.toContain("\u2029");
    expect(JSON.parse(escaped)).toEqual(original);
  });

  it("escapes ampersands", () => {
    const original = { text: "salt & pepper &amp; more" };
    const escaped = escapeJsonForScript(JSON.stringify(original));
    expect(escaped).not.toContain("&");
    expect(JSON.parse(escaped)).toEqual(original);
  });
});

describe("escapeHtmlAttribute", () => {
  it("replaces the five special characters with entities", () => {
    expect(escapeHtmlAttribute(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("escapes the ampersands in a query string", () => {
    expect(escapeHtmlAttribute("https://example.com/iframe.html?unit=mods&unwrapped&readOnly"))
      .toBe("https://example.com/iframe.html?unit=mods&amp;unwrapped&amp;readOnly");
  });
});
