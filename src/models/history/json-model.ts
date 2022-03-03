import { getSnapshot, types } from "mobx-state-tree";

const JArray: any = types.array(types.late(() => JValue));
export const MstJsonObject: any = types.map(types.late(() => JValue));
const JValue = types.union(MstJsonObject, JArray, types.string, types.number, types.null);

(window as any).testGeneric = (obj: any) => {
    const testObject = MstJsonObject.create(obj);
    console.log(getSnapshot(testObject));
};
