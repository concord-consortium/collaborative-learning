import { types, Instance } from "mobx-state-tree";
import { Value, ValueJSON } from "slate";
import Plain from "slate-plain-serializer";

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
    format: types.maybe(types.string),
    changes: 0
  })
  .views(self => ({
    get joinText() {
      return Array.isArray(self.text)
              ? self.text.join("\n")
              : self.text;

    }
  }))
  .extend(self => {
    // local cache of Slate's immutable.js object
    let slateValue: Value | undefined;

    // views
    function getSlate() {
      if (slateValue) { return slateValue; }

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
      return slateValue = Value.fromJSON(parsed);
    }

    function convertSlate() {
      if (slateValue) { return slateValue; }

      switch (self.format) {
        case "slate":
          return getSlate();
        case "markdown":
          // handle markdown import here; for now we treat as text
        default:
          return slateValue = Plain.deserialize(self.joinText);
      }
    }

    // actions
    function setText(text: string) {
      self.format = undefined;
      self.text = text;
      slateValue = undefined;
    }

    function setMarkdown(text: string) {
      self.format = "markdown";
      self.text = text;
      slateValue = undefined;
    }

    function setSlate(value: Value) {
      self.format = "slate";
      self.text = JSON.stringify(value.toJSON());
      ++self.changes;
      slateValue = value;
    }

    function setSlateReadOnly(value: Value) {
      slateValue = value;
    }

    return {
      views: {
        getSlate,
        convertSlate
      },
      actions: {
        setText,
        setMarkdown,
        setSlate,
        setSlateReadOnly
      }
    };
  });

export type TextContentModelType = Instance<typeof TextContentModel>;
