import { useCallback } from "react";
import { useQuery } from "react-query";
import { IGetNetworkResourcesParams, IGetNetworkResourcesResponse } from "../../functions/src/shared";
import { useFirebaseFunction } from "./use-firebase-function";
import { useProblemPath } from "./use-stores";
import { useUserContext } from "./use-user-context";

export function useNetworkResources() {
  const context = useUserContext();
  const problemPath = useProblemPath();
  const getNetworkResources_v1 = useFirebaseFunction<IGetNetworkResourcesParams>("getNetworkResources_v1");
  const getNetworkResources = useCallback(() => {
    return getNetworkResources_v1({ context, problem: problemPath });
  }, [context, getNetworkResources_v1, problemPath]);
  return useQuery(`${context.network}/resources`, async () => {
    const networkResources = await getNetworkResources();
    const { response } = networkResources.data as IGetNetworkResourcesResponse;
    return response;
  });
}
