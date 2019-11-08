import { createStickyNote, createTextSupport, ESupportMode, ESupportType, SupportModel } from "./support";
import { DocumentContentModel } from "../document/document-content";
import "../../models/tools/text/text-registration";

describe("support model", () => {

  it("createTextSupport() creates legacy text supports", () => {
    const supportText = "Some support text";
    const support = createTextSupport(supportText);
    expect(support).toEqual({
      type: ESupportType.text,
      content: supportText
    });
  });

  it("createStickyNote() creates sticky-note supports", () => {
    const supportText = "Some support text";
    const support = createStickyNote(supportText);
    expect(support).toEqual({
      type: ESupportType.text,
      mode: ESupportMode.stickyNote,
      content: supportText
    });
  });

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

  const tileContent = {
          tiles: [
            {
              content: {
                type: "Text",
                text: [
                  "What is the scale factor from the smaller square to the larger square?"
                ]
              }
            },
          ]
        };

  it("supports authored document-style supports", () => {
    const support = SupportModel.create({
      type: ESupportType.document,
      content: tileContent as any
    });
    const content = DocumentContentModel.create(JSON.parse(support.content));
    expect(content.rowCount).toBe(1);
    expect(content.getRowByIndex(0)?.tileCount).toBe(1);
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
