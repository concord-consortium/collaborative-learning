import { Instance, types } from "mobx-state-tree";

export const StampModel = types
  .model("Stamp", {
    url: types.string,
    width: types.number,
    height: types.number
  })
  .preProcessSnapshot(snapshot => {
    // The set of available stamps is saved with each drawing tool instance (why?).
    // Thus, we have to convert from pre-webpack/assets reform paths to curriculum
    // paths on loading documents.
    const newUrl = snapshot.url.replace("assets/tools/drawing-tool/stamps",
                                        "curriculum/moving-straight-ahead/stamps");
    return newUrl && (newUrl !== snapshot.url)
            ? { ...snapshot, ...{ url: newUrl } }
            : snapshot;
  });
export interface StampModelType extends Instance<typeof StampModel> {}
