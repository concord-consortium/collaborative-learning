// Marker HTML attributes used to round-trip slate chip elements through HTML
// serialization. When the editor serializes to HTML (slateToHtml), each chip emits
// a marker <span> carrying its type and a stable id; on load, htmlToSlate uses these
// to reconstruct the chip elements. The chips' display content (highlight text,
// variable value) is intentionally not embedded — it lives on the text content's
// highlightedText list or on the SharedVariables shared model and is looked up by
// id at render time.

export const kSlateChipTypeAttr = "data-slate-type";
export const kHighlightChipIdAttr = "data-slate-highlight-id";
export const kVariableChipReferenceAttr = "data-slate-reference";
