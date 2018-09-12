import { TextContentModel, kTextToolID, emptyJson } from "./text-content";
import { Value } from "slate";

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
    const outJson = model.getSlate();
    expect(outJson).toBeDefined();

    // handles errors gracefully
    const bogus1 = TextContentModel.create({ format: "slate", text: "foo" });
    expect(bogus1.getSlate()).toBeDefined();
    const bogus2 = TextContentModel.create({ format: "slate", text: ["foo", "bar"] });
    expect(bogus2.getSlate()).toBeDefined();
  });

});
