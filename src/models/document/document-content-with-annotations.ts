import { types } from "mobx-state-tree";

import { BaseDocumentContentModel } from "./base-document-content";
import { ArrowAnnotation, IArrowAnnotation, IArrowAnnotationSnapshot } from "../annotations/arrow-annotation";

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

// ✔️ 1•log sparrow creation and (1.1) the source and target tile type + ID
// ✔️ 3•log label text
// ✔️ 4•log show and hide of sparrows
// ✔️ 5•log sparrow deletion

//write in the ticket
//2 is inside of 1
// 6•incorporate into typical records that know student's name, id, time of creation, group and class context
//6 is already done for us

//Ask leslie if we really want the type - because right now I have the objectType (ex: "cell", "rectangle")
// but not from the tile itself "Table"

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
      console.log("arrow:", arrow);
      console.log("arrow:", arrow.id);
      console.log("----------------");
      //1 log sparrow creation
      //1.1 - tile  type for start and end points
      console.log("sparrowSource:", arrow.sourceObject);
      const sparrowSourceType = arrow.sourceObject?.objectType;
      const sparrowTargetType = arrow.targetObject?.objectType;

      //1 - when created log sparrow id.
      // 1.1 TODO: we can change the syntax to sparrowSourceType and sparrowTargetType
      //but also include the ID of the tile from source and target
      console.log(`LOG 1 arrow created from ${sparrowSourceType} to ${sparrowTargetType}` );

    },
    deleteAnnotation(annotationId: string) {
      self.annotations.delete(annotationId);
      console.log(`LOG 5 arrow deleted`);

    },
    addAnnotationFromImport(id: string, annotation: IArrowAnnotationSnapshot){
      if (self.annotations) {
        self.annotations.set(id, annotation);
      }
    }
  }));
