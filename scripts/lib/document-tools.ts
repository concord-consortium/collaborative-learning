// The `tools` field, derived from a document's content the way the running client derives it.
//
// Sort Work groups documents by this field, so a row without it files the document under "No Tools".
// The client recomputes it on every content save, in `useDocumentSyncToFirebase`; this is the same
// computation for a document whose content is only ever read, never saved again. Keep the two in step.

/**
 * The tile types a document uses, plus "Sparrow" when it carries arrow annotations.
 *
 * Takes the realtime-database `documents/<key>` node rather than its content string, because the two
 * ways of having no tiles have to be told apart. A node with no `content` key is a document that was
 * created and never saved — it has no tiles, and `[]` says so. Content that will not parse is a
 * document this cannot read, and returns `undefined`: `[]` there would assert emptiness the run never
 * established.
 */
export function toolsFromDocumentNode(node: any): string[] | undefined {
  if (!node || typeof node !== "object") return undefined;
  // Never saved, so there is nothing to have tiles in.
  if (node.content == null) return [];

  let content: any;
  try {
    content = JSON.parse(node.content);
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
