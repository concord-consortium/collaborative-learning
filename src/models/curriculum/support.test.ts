import { SupportModel, ESupportType } from "./support";

describe("support model", () => {

  it("supports legacy support format", () => {
    const support = SupportModel.create({
      text: "Is it plugged in?"
    } as any);
    expect(support).toEqual({
      type: ESupportType.text,
      content: "Is it plugged in?"
    });
  });
  it("supports text-only supports", () => {
    const support = SupportModel.create({
      type: ESupportType.text,
      content: "Did you try turning it on and off?"
    });
    expect(support).toEqual({
      type: ESupportType.text,
      content: "Did you try turning it on and off?"
    });
  });
  it("supports document-style supports", () => {
    const support = SupportModel.create({
      type: ESupportType.document,
      content: "some/long/firebase/path"
    });
    expect(support).toEqual({
      type: ESupportType.document,
      content: "some/long/firebase/path"
    });
  });
});
