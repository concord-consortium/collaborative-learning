import { types } from "mobx-state-tree";

import { BaseDocumentContentModel } from "./base-document-content";
import { ArrowAnnotation, IArrowAnnotation, IArrowAnnotationSnapshot } from "../annotations/arrow-annotation";
import { logSparrowCreateOrDelete } from "../tiles/log/log-sparrow-event";
import { LogEventName } from "../../../src/lib/logger-types";

/**
 * This is one part of the DocumentContentModel. The other parts are
 * DocumentContentModelWidthTileDragging and BaseDocumentContentModel.
 * It was split out to reduce the size of the DocumentContentModel.
 *
 * This file should contain the properties, views, and actions that are
 * related to adorning documents (i.e. sparrows).
 */

//***************************************** GUIDELINES ********************************************** ↳ ✔️

// As researchers, we want to log the use of all important system features.
// We will log sparrow use along with existing student records

// ✔️ 1•log sparrow creation and the source and target tile type + ID
// ✔️ 3•log label text
// ✔️ 4•log show and hide of sparrows
// ✔️ 5•log sparrow deletion

//previous log ticket: https://github.com/concord-consortium/collaborative-learning/pull/2160/files

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
      logSparrowCreateOrDelete(LogEventName.SPARROW_CREATION, arrow, self);
    },
    deleteAnnotation(annotationId: string) {
      //Retrieve the annotation and log before deletion
      const annotation = self.annotations.get(annotationId);
      if (annotation){
        logSparrowCreateOrDelete(LogEventName.SPARROW_DELETION, annotation, self);
      }
      self.annotations.delete(annotationId);
    },
    addAnnotationFromImport(id: string, annotation: IArrowAnnotationSnapshot){
      if (self.annotations) {
        self.annotations.set(id, annotation);
      }
    }
  }));
