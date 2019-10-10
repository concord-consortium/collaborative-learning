import { IStores as IBaseStores, createStores as createBaseStores } from "../../../models/stores/stores";
import { HubStoreType, HubStore } from "./hub-store";
import { IoT } from "../../lib/iot";

export interface IStores extends IBaseStores {
  hubStore: HubStoreType;
  iot: IoT;
}

interface ICreateStores extends Partial<IStores> {
  demoName?: string;
}

export function createStores(params?: ICreateStores): IStores {
  let baseParams;
  if (params) {
    const { hubStore, iot, ...others } = params;
    baseParams = others;
  }
  const baseStore = createBaseStores(baseParams);
  return {
    ...baseStore,
    hubStore: params && params.hubStore || HubStore.create({}),
    iot: params && params.iot || new IoT()
  };
}
