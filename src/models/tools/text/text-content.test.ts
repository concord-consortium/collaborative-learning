import { TextContentModel, kTextToolID, emptyJson } from "./text-content";
import { Value, ValueJSON } from "slate";
import Plain from "slate-plain-serializer";

describe("TextContentModel", () => {

  it("accepts default arguments on creation", () => {
    const model = TextContentModel.create();
    expect(model.type).toBe(kTextToolID);
    expect(model.text).toBe("");
    expect(model.format).toBeUndefined();
  });

  it("accepts override arguments on creation", () => {
    const text = "Some text";
    const format = "plain";
    const model = TextContentModel.create({
                    type: kTextToolID,
                    text, format
                  });
    expect(model.type).toBe(kTextToolID);
    expect(model.text).toBe(text);
    expect(model.joinText).toBe(text);
    expect(model.format).toBe(format);
  });

  it("handles arrays of strings", () => {
    const text = ["some", "array", "strings"];
    const model = TextContentModel.create({ text });
    expect(model.text).toEqual(text);
    expect(model.joinText).toBe(text.join("\n"));

    const flat = "flat string";
    model.setText(flat);
    expect(model.text).toBe(flat);
  });

  it("handles slate format strings", () => {
    const model = TextContentModel.create();
    model.setSlate(Value.fromJSON(emptyJson));
    const slate = model.getSlate();
    expect(Plain.serialize(slate)).toBe("");

    // handles errors gracefully
    const bogus1 = TextContentModel.create({ format: "slate", text: "foo" });
    expect(bogus1.getSlate()).toBeDefined();
    const bogus2 = TextContentModel.create({ format: "slate", text: ["foo", "bar"] });
    expect(bogus2.convertSlate()).toBeDefined();
  });

  const fooJson: ValueJSON = {
                document: {
                  nodes: [{
                    object: "block",
                    type: "paragraph",
                    nodes: [{
                      object: "text",
                      leaves: [{
                        text: "foo"
                      }]
                    }]
                  }]
                }
              };

  it("converts to slate correctly", () => {
    const foo = "foo";
    const model = TextContentModel.create({ text: foo });
    expect(Plain.serialize(model.convertSlate())).toBe(foo);

    model.setMarkdown("foo");
    expect(model.format).toBe("markdown");
    expect(Plain.serialize(model.convertSlate())).toBe(foo);

    const fooValue = Value.fromJSON(fooJson);
    model.setSlate(fooValue);
    expect(model.format).toBe("slate");
    expect(Plain.serialize(model.convertSlate())).toBe(foo);
  });
});
