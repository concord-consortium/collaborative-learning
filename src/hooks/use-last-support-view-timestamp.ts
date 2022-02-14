import { useState } from "react";
import { useQuery } from "react-query";
import { useStores } from "./use-stores";
import { useSyncMstPropToFirebase } from "./use-sync-mst-prop-to-firebase";

export function useLastSupportViewTimestamp(isEnabled: boolean) {
  const { db: { firebase }, user } = useStores();
  // flag so we only issue the initialization query once
  const [isInitialized, setIsInitialized] = useState(!!user.lastSupportViewTimestamp);

  // initialize last support view timestamp from firebase
  const path = firebase.getLastSupportViewTimestampPath();
  const ref = firebase.ref(path);
  useQuery<typeof user.lastSupportViewTimestamp>(path,
    () => ref.get().then(snap => snap.val()).catch(() => undefined), {
    enabled: isEnabled && !isInitialized,
    retry: false,
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
    // only enable the mutation after the value has been initialized from firebase
    enabled: isEnabled && isInitialized
  });
}
