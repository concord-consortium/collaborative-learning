import Html from "slate-html-serializer";

enum SlateType {
  block,
  mark
}

interface ITagDefinition {
  slateType: SlateType;
  slateName: string;
  htmlTag: string;
}

const tags: ITagDefinition[] = [
  {slateType: SlateType.mark, slateName: "bold", htmlTag: "strong"},
  {slateType: SlateType.mark, slateName: "italic", htmlTag: "em"},
  {slateType: SlateType.mark, slateName: "superscript", htmlTag: "sup"},
  {slateType: SlateType.mark, slateName: "subscript", htmlTag: "sub"},
  {slateType: SlateType.mark, slateName: "code", htmlTag: "code"},
  {slateType: SlateType.mark, slateName: "underlined", htmlTag: "u"},
  {slateType: SlateType.block, slateName: "paragraph", htmlTag: "p"},
  {slateType: SlateType.block, slateName: "heading1", htmlTag: "h1"},
  {slateType: SlateType.block, slateName: "heading2", htmlTag: "h2"},
  {slateType: SlateType.block, slateName: "heading3", htmlTag: "h3"},
  {slateType: SlateType.block, slateName: "heading4", htmlTag: "h4"},
  {slateType: SlateType.block, slateName: "heading5", htmlTag: "h5"},
  {slateType: SlateType.block, slateName: "heading6", htmlTag: "h6"},
  {slateType: SlateType.block, slateName: "bulleted-list", htmlTag: "ul"},
  {slateType: SlateType.block, slateName: "ordered-list", htmlTag: "ol"},
  {slateType: SlateType.block, slateName: "list-item", htmlTag: "li"},
  {slateType: SlateType.block, slateName: "horizontal-rule", htmlTag: "hr"}
];

const rules = [
  {
    deserialize(el: Element, next: (children: any) => void) {
      const tag = tags.find((t) => t.htmlTag ===  el.tagName.toLowerCase());
      if (tag) {
        switch (tag.slateType) {
          case SlateType.block:
            return {
              object: "block",
              type: tag.slateName,
              data: { className: el.getAttribute("class") },
              nodes: next(el.childNodes)
            };
          case SlateType.mark:
          default:
            return {
              object: "mark",
              type: tag.slateName,
              nodes: next(el.childNodes)
            };
        }
      }
    },
    serialize(_obj: any, _children: any) {
      // There is no need for a serializer (that is, conversion from Slate's
      // document model -> html), so we will just announce that our code-path
      // accidentally reached this point.
      console.warn(`Warning! Slate editor serialize() was called. Not yet implemented`);
      return [];
    }
  }
];

export default class SlateHtmlSerializer extends Html {
  constructor() {
    super({rules});
  }
}
