import { stripIndent } from "common-tags";
import { comma, spaces, StringBuilder } from "./string-builder";

describe("string builder utility functions", () => {
  it("comma() should return a comma when appropriate", () => {
    expect(comma(true)).toBe(",");
    expect(comma(false)).toBe("");
  });

  it("spaces() should return an appropriate number of spaces", () => {
    const expected = ["", " ", "  ", "   "];
    for (let i = 0; i < expected.length; ++i) {
      expect(spaces(i)).toBe(expected[i]);
    }
  });
});

describe("StringBuilder", () => {

  it("should be empty initially", () => {
    expect(new StringBuilder().build()).toBe("");
  });

  it("should support pushing individual lines", () => {
    const builder = new StringBuilder();
    builder.pushLine("{");
    builder.pushLine(`"foo": "bar"`, 2);
    builder.pushLine("}");
    expect(builder.build()).toBe(stripIndent`
                                  {
                                    "foo": "bar"
                                  }` + "\n"); // includes trailing newline
    expect(builder.build().trim()).toBe(stripIndent`
                                        {
                                          "foo": "bar"
                                        }`);
  });

  it("should support pushing arrays of lines", () => {
    const lines = ["{", `  "foo": "bar"`, "}"];
    const builder = new StringBuilder();
    builder.pushLine("[");
    builder.pushLines([]);
    builder.pushLines(lines, 2);
    builder.pushLine("]");
    expect(builder.build().trim()).toBe(stripIndent`
                                        [
                                          {
                                            "foo": "bar"
                                          }
                                        ]`);
  });

  it("should support pushing built blocks of lines", () => {
    const block = new StringBuilder();
    block.pushLine("{");
    block.pushLine(`"foo": "bar"`, 2);
    block.pushLine("}");

    const builder = new StringBuilder();
    builder.pushLine("[");
    builder.pushBlock(block.build(), 2);
    builder.pushLine("]");
    expect(builder.build().trim()).toBe(stripIndent`
                                        [
                                          {
                                            "foo": "bar"
                                          }
                                        ]`);
  });

  it("should support pushing manual blocks of lines", () => {
    const block = `  {\n    "foo": "bar"\n  }`;
    const builder = new StringBuilder();
    builder.pushLine("[");
    builder.pushBlock(block);
    builder.pushLine("]");
    expect(builder.build().trim()).toBe(stripIndent`
                                        [
                                          {
                                            "foo": "bar"
                                          }
                                        ]`);
  });
});
