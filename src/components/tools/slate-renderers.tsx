import * as React from "react";

// These renderers are used by the Slate editor to translate a mark or block
// into its HTML representation.

export function renderSlateMark(markName: string, attributes: any, children: any) {
  switch (markName) {
    case "bold":
      return (<strong {...attributes}>{children}</strong>);
    case "code":
      return (<code {...attributes}>{children}</code>);
    case "italic":
      return (<em{ ...attributes}>{children}</em>);
    case "underlined":
      return (<u {...attributes}>{children}</u>);
    case "deleted":
      return (<del {...attributes}>{children}</del>);
    case "inserted":
      return (<mark {...attributes}>{children}</mark>);
    case "superscript":
      return (<sup {...attributes}>{children}</sup>);
    case "subscript":
      return (<sub {...attributes}>{children}</sub>);
    default:
      return null;
  }
}

export function renderSlateBlock(blockName: string, attributes: any, children: any) {
  switch (blockName) {
    case "paragraph":
      return (<p {...attributes}>{children}</p>);
    case "heading1":
      return (<h1 {...{attributes}}>{children}</h1>);
    case "heading2":
      return (<h2 {...{attributes}}>{children}</h2>);
    case "heading3":
      return (<h3 {...{attributes}}>{children}</h3>);
    case "heading4":
      return (<h4 {...{attributes}}>{children}</h4>);
    case "heading5":
      return (<h5 {...{attributes}}>{children}</h5>);
    case "heading6":
      return (<h6 {...{attributes}}>{children}</h6>);
    case "code":
      return (<code {...attributes}>{children}</code>);
    case "ordered-list":
      return (<ol {...attributes}>{children}</ol>);
    case "bulleted-list":
    case "todo-list":
      return (<ul {...attributes}>{children}</ul>);
    case "list-item":
      return (<li {...{attributes}}>{children}</li>);
    case "horizontal-rule":
      return (<hr />);

    // Note: Tables, as implemented in the current de-serializer, do not
    // nest a <tbody> element within the <table>. A new rule could easily
    // be added that would handle this case and bring the DOM in alignment
    // with the slate model.
    //
    // TODO: Add rule for <tbody>.

    case "table":
      return (<table {...attributes}>{children}</table>);
    case "table-row":
      return (<tr {...attributes}>{children}</tr>);
    case "table-head":
      return (<th {...attributes}>{children}</th>);
    case "table-cell":
      return (<td {...attributes}>{children}</td>);
    case "block-quote":
      return (<blockquote {...attributes}>{children}</blockquote>);

    case "image":  // TODO: This is broken.
      // return (<img src={src} title={title} />);
    case "link":   // TODO: This is broken.
      // return (<a href={href} {...attributes}>{children}</a>);

    default:
      return null;
  }
}
