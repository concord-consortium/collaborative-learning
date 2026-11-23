/**
 * Describes a number line point an annotation is anchored to. Like the geometry tile, the number
 * line has no summarizer of its own, so the phrase has to carry the value rather than the point id.
 */
import { AnnotationDescriberParams } from "../ai-summarizer-types";

export function describeNumberlineObject(
  { tile, objectId }: AnnotationDescriberParams
): string | undefined {
  const point = tile?.content?.points?.[objectId];
  if (!point) { return undefined; }
  return `the ${point.isOpen ? "open " : ""}point at ${point.xValue}`;
}
