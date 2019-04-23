import { IStores as IBaseStores, createStores as createBaseStores } from "../../../models/stores/stores";
import { ThingStoreType, ThingStore } from "./thing-store";
import { IoT } from "../../lib/iot";

export interface IStores extends IBaseStores {
  thingStore: ThingStoreType;
  iot: IoT;
}

export interface ICreateStores {
  thingStore?: ThingStoreType;
  iot?: IoT;
}

export function createStores(params?: ICreateStores): IStores {
  let baseParams;
  if (params) {
    const { thingStore, iot, ...others } = params;
    baseParams = others;
  }
  const baseStore = createBaseStores(baseParams);
  return {
    ...baseStore,
    thingStore: params && params.thingStore || ThingStore.create({}),
    iot: params && params.iot || new IoT()
  };
}
