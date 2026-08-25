// The `tools` field, derived from a document's content the way the running client derives it.
//
// Sort Work groups documents by this field, so a row without it files the document under "No Tools".
// The client recomputes it on every content save, in `useDocumentSyncToFirebase`; this is the same
// computation for a document whose content is only ever read, never saved again. Keep the two in step.

/**
 * The tile types a document uses, plus "Sparrow" when it carries arrow annotations.
 *
 * Returns `undefined` when the content cannot be read, which the caller must not conflate with `[]`:
 * an empty array claims the document has no tiles, and saying that about a document nobody could
 * parse would be a guess written into the database.
 */
export function toolsFromContent(contentJson: string | undefined): string[] | undefined {
  if (!contentJson) return undefined;

  let content: any;
  try {
    content = JSON.parse(contentJson);
  } catch {
    return undefined;
  }
  if (!content || typeof content !== "object") return undefined;

  const tools: string[] = [];
  for (const tile of Object.values<any>(content.tileMap ?? {})) {
    const type = tile?.content?.type;
    if (type && !tools.includes(type)) tools.push(type);
  }

  // Only arrows count, matching the client. Other annotation types are not tools.
  const annotations = Object.values<any>(content.annotations ?? {});
  if (annotations.some(annotation => annotation?.type === "arrowAnnotation") && !tools.includes("Sparrow")) {
    tools.push("Sparrow");
  }

  return tools;
}
