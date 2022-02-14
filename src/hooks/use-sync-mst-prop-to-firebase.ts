import { throttle as _throttle } from "lodash";
import { reaction } from "mobx";
import { IAnyStateTreeNode } from "mobx-state-tree";
import { useEffect, useMemo } from "react";
import { useMutation, UseMutationOptions } from "react-query";
import { Firebase } from "../lib/firebase";

/*
 * useSyncMstPropToFirebase
 *
 * Custom hook for synchronizing a simple property of an MST model to firebase.
 * Uses a MobX reaction and ReactQuery's useMutation hook to handle retries, etc.
 * Automatically retries on error with a linear back-off which maxes at 30 sec by default.
 */
interface IProps<T> {
  firebase: Firebase;
  model: IAnyStateTreeNode;
  prop: string;
  path: string;
  enabled?: boolean;
  options?: Omit<UseMutationOptions<unknown, unknown, T>, 'mutationFn'>;
  throttle?: number;
}
export function useSyncMstPropToFirebase<T extends string | number | boolean | undefined>({
  firebase, model, prop, path, enabled = true, options, throttle = 1000 }: IProps<T>) {

  const finalOptions: Omit<UseMutationOptions<unknown, unknown, T>, 'mutationFn'> = {
    // default is to retry with linear back-off to a maximum
    retry: true,
    retryDelay: (attempt) => Math.min(attempt * 5, 30),
    // but clients may override the defaults
    ...options
  };
  const mutation = useMutation((value: T) => {
    return firebase.ref(path).update({ [prop]: value });
  }, finalOptions);
  const throttledMutate = useMemo(() => _throttle(mutation.mutate, throttle), [mutation.mutate, throttle]);

  useEffect(() => {
    const cleanup = enabled
            ? reaction(() => model[prop], value => {
                // reset (e.g. stop retrying and restart) when value changes
                mutation.isError && mutation.reset();
                throttledMutate(value);
              })
            : undefined;
    return () => cleanup?.();
  }, [enabled, model, mutation, prop, throttledMutate]);

  return mutation;
}
