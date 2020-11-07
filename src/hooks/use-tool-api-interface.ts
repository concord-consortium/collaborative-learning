import { each } from "lodash";
import { useRef } from "react";
import { IToolApi, IToolApiInterface, IToolApiMap } from "../components/tools/tool-tile";

export function useToolApiInterface(): [IToolApiMap, IToolApiInterface] {
  const toolApiMap = useRef<IToolApiMap>({});
  const toolApiInterface = useRef<IToolApiInterface>({
    register: (id: string, toolApi: IToolApi) => {
      toolApiMap.current[id] = toolApi;
    },
    unregister: (id: string) => {
      delete toolApiMap.current[id];
    },
    getToolApi: (id: string) => {
      return toolApiMap.current[id];
    },
    forEach: (callback: (api: IToolApi) => void) => {
      each(toolApiMap.current, api => callback(api));
    }
  });
  return [toolApiMap.current, toolApiInterface.current];
}
