import { types, Instance } from "mobx-state-tree";
import { Value, ValueJSON } from "slate";

export const kTextToolID = "Text";

export const StringOrArray = types.union(types.string, types.array(types.string));

export const emptyJson: ValueJSON = {
              document: {
                nodes: [{
                  object: "block",
                  type: "paragraph",
                  nodes: [{
                    object: "text",
                    leaves: [{
                      text: ""
                    }]
                  }]
                }]
              }
            };

const errorJson: ValueJSON = {
        document: {
          nodes: [{
            object: "block",
            type: "paragraph",
            nodes: [{
              object: "text",
              leaves: [{
                text: "A slate error occurred"
              }]
            }]
          }]
        }
      };

export const TextContentModel = types
  .model("TextTool", {
    type: types.optional(types.literal(kTextToolID), kTextToolID),
    text: types.optional(StringOrArray, ""),
    // e.g. "markdown", "slate", "quill", empty => plain text
    format: types.maybe(types.string)
  })
  .views(self => ({
    get joinText() {
      return Array.isArray(self.text)
              ? self.text.join("\n")
              : self.text;

    },
    getSlate() {
      const text = Array.isArray(self.text) ? "" : self.text;
      let parsed = emptyJson;
      if (text) {
        try {
          parsed = JSON.parse(text);
        }
        catch (e) {
          // TODO: error handling strategy
          parsed = errorJson;
        }
      }
      return Value.fromJSON(parsed);
    }
  }))
  .actions(self => ({
    setText(text: string) {
      self.format = undefined;
      self.text = text;
    },
    setSlate(value: any) {
      self.format = "slate";
      self.text = JSON.stringify(value);
    }
  }));

export type TextContentModelType = Instance<typeof TextContentModel>;
