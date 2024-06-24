import { types } from "mobx-state-tree";

import { BaseDocumentContentModel } from "./base-document-content";
import { ArrowAnnotation, IArrowAnnotation } from "../annotations/arrow-annotation";
import { logSparrowCreate, logSparrowDelete } from "../tiles/log/log-sparrow-event";
import { LogEventName } from "../../../src/lib/logger-types";

/**
 * This is one part of the DocumentContentModel, which is split into four parts of more manageable size:
 * - BaseDocumentContentModel
 * - DocumentContentModelWithAnnotations
 * - DocumentContentModelWithTileDragging
 * - DocumentContentModel
 *
 * This file should contain the properties, views, and actions that are
 * related to adorning documents (i.e. sparrows).
 */

export const DocumentContentModelWithAnnotations = BaseDocumentContentModel
  .named("DocumentContentModelWithAnnotations")
  .props({
    annotations: types.map(ArrowAnnotation)
  })
  .views(self => ({
    // If anyReference is true, annotations related to any tile in tileIds will be included,
    // even if they also reference tiles not in tileIds
    getAnnotationsUsedByTiles(tileIds: string[], anyReference?: boolean) {
      // TODO Make generic to handle any type of annotation, not just arrow annotations
      const annotations: Record<string, IArrowAnnotation> = {};
      Array.from(self.annotations.values()).forEach(annotation => {
        const includesSource = tileIds.includes(annotation.sourceObject?.tileId ?? "");
        const includesTarget = tileIds.includes(annotation.targetObject?.tileId ?? "");
        const include = anyReference ? includesSource || includesTarget : includesSource && includesTarget;
        if (include) {
          annotations[annotation.id] = annotation;
        }
      });
      return annotations;
    }
  }))
  .actions(self => ({
    addArrow(arrow: IArrowAnnotation) {
      self.annotations.put(arrow);
      logSparrowCreate(LogEventName.SPARROW_CREATION, arrow, self);
    },
    deleteAnnotation(annotationId: string) {
      self.annotations.delete(annotationId);
      logSparrowDelete(LogEventName.SPARROW_DELETION, annotationId);
    },
    selectAnnotations(ids: string[]) {
      for (const annotation of self.annotations.values()) {
        annotation.setSelected(ids.includes(annotation.id));
      }
    }
  }))
  .actions(self => ({
    deleteSelected() {
      const keys = self.annotations.keys();
      for (const annoId of keys) {
        if (self.annotations.get(annoId)?.isSelected) {
          self.deleteAnnotation(annoId);
        }
      }
    }
  }));
