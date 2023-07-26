import { types } from "mobx-state-tree";

import { DocumentContentModelWithTileDragging } from "./drag-tiles";
import { ArrowAnnotation, ArrowAnnotationType } from "../annotations/arrow-annotation";

/**
 * This is one part of the DocumentContentModel. The other parts are
 * DocumentContentModelWidthTileDragging and BaseDocumentContentModel.
 * It was split out to reduce the size of the DocumentContentModel.
 *
 * This file should contain the properties, views, and actions that are
 * related to adorning documents (i.e. sparrows).
 */
export const DocumentContentModelWithAnnotations = DocumentContentModelWithTileDragging
  .named("DocumentContentModelWithAdornments")
  .props({
    annotations: types.array(ArrowAnnotation)
  })
  .actions(self => ({
    addArrow(arrow: ArrowAnnotationType) {
      self.annotations.push(arrow);
    }
  }));
