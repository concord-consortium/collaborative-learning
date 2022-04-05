import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "react-query";
import { useStores } from "./use-stores";
import { useSyncMstPropToFirebase } from "./use-sync-mst-prop-to-firebase";

export function useLastSupportViewTimestamp(isEnabled = true) {
  const queryClient = useQueryClient();
  const { db: { firebase }, user } = useStores();
  // flag so we never issue the initialization query more than once
  const [isInitialized, setIsInitialized] = useState(() => isEnabled && !!user.lastSupportViewTimestamp);
  const shouldMutate = useRef(true);

  // initialize last support view timestamp from firebase
  const path = firebase.getLastSupportViewTimestampPath();
  const ref = firebase.ref(path);
  useQuery<typeof user.lastSupportViewTimestamp>(path,
    () => ref.get().then(snap => snap.val()).catch(() => undefined), {
    enabled: isEnabled && !isInitialized,
    retry: false,
    staleTime: Infinity,
    onSuccess: value => {
      // it seems we can get here even for disabled queries ¯\_(ツ)_/¯
      isEnabled && !isInitialized && value && user.setLastSupportViewTimestamp(value);
    },
    // enable the mutation regardless of how the query was settled
    onSettled: () => isEnabled && !isInitialized && setIsInitialized(true)
  });

  // sync user's last support view time stamp to firebase
  useSyncMstPropToFirebase<typeof user.lastSupportViewTimestamp>({
    firebase, model: user, prop: "lastSupportViewTimestamp", path: firebase.getUserPath(user),
    enabled: isEnabled,
    shouldMutate: () => shouldMutate.current,
    options: {
      onMutate: async value => {
        // cancel any in-flight queries if we get a user mutation
        await queryClient.cancelQueries(path);
        // if query cache is up to date then query triggered the mutation
        const inSync = value === queryClient.getQueryData(path);
        const shouldUpdate = !inSync && !!value;
        // optimistically update query cache
        shouldUpdate && queryClient.setQueryData(path, value);
        // enable subsequent mutation (onMutate is called before shouldMutate)
        shouldMutate.current = shouldUpdate;
        // ignore query response after the first mutation
        setIsInitialized(true);
      }
    }
  });
}
