import { throttle as _throttle } from "lodash";
import { IAnyStateTreeNode, onSnapshot, SnapshotOut } from "mobx-state-tree";
import { useEffect, useMemo } from "react";
import { useMutation, UseMutationOptions } from "react-query";
import { Firebase } from "../lib/firebase";

/*
 * useSyncMstNodeToFirebase
 *
 * Custom hook for synchronizing a complex property (e.g. MST model or types.map) to firebase.
 * Uses MST's onSnapshot handler to respond to changes and ReactQuery's useMutation hook to
 * handle retries, etc. Updates are throttled to 1 sec by default but is client-configurable.
 * Automatically retries on error with a linear back-off which maxes at 30 sec by default.
 */
interface IProps<T> {
  firebase: Firebase;
  model: T; // MST model or complex type (e.g. types.map())
  path: string;
  enabled: boolean;
  options?: Omit<UseMutationOptions<unknown, unknown, SnapshotOut<T>>, 'mutationFn'>;
  throttle?: number;
  transform?: (snapshot: SnapshotOut<T>) => any;
}
export function useSyncMstNodeToFirebase<T extends IAnyStateTreeNode>({
  firebase, model, path, enabled, options: clientOptions, throttle = 1000, transform
}: IProps<T>) {

  const options: Omit<UseMutationOptions<unknown, unknown, SnapshotOut<T>>, 'mutationFn'> = {
    // default is to retry with linear back-off to a maximum
    retry: true,
    retryDelay: (attempt) => Math.min(attempt * 5, 30),
    // but clients may override the defaults
    ...clientOptions
  };
  // HERE IS WHERE THE ACTUAL FIREBASE CALL IS MADE WE PROBABLY JUST NEED LINE 37 JUST CALL DIRECLY
  const mutation = useMutation((snapshot: SnapshotOut<T>) => {
    return firebase.ref(path).update(transform?.(snapshot) ?? snapshot); // PATH BLAH SHOULD BE UPDATED WITH WITH THE SNAPSHOT IN HAND
  }, options);
  const throttledMutate = useMemo(() => _throttle(mutation.mutate, throttle), [mutation.mutate, throttle]);

  // AN AN EXAMPLE OF A ON SNAPSHOT HANDLER IN A STORE:
  // ADDING A HANDLER ON AN EFFECT NOT ON RENDER
  useEffect(() => {
    const cleanup = enabled
            // ADD A HANDLER ON SNAPSHOT PARAMES CAME FROM THE CALLER EG THE ONE IN
            // WE CAN CALL OUR SNAPSHOT WITH THE PERSISTENT UI SNAPSHOT
            ? onSnapshot<SnapshotOut<T>>(model, snapshot => {
                // reset (e.g. stop retrying and restart) when value changes
                mutation.isError && mutation.reset();
                throttledMutate(snapshot);
              })
            : undefined;
    return () => cleanup?.();
  }, [enabled, model, mutation, throttledMutate]);

  return mutation;
}
