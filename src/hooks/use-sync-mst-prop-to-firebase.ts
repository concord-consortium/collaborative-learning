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
  shouldMutate?: boolean | ((value: T) => boolean),
  options?: Omit<UseMutationOptions<unknown, unknown, T>, 'mutationFn'>;
  throttle?: number;
  additionalMutation?: (prop: string, value: T) => Promise<unknown>;
}
export function useSyncMstPropToFirebase<T extends string | number | boolean | undefined>({
  firebase, model, prop, path, enabled = true, shouldMutate = true, options: clientOptions, throttle = 1000,
  additionalMutation
}: IProps<T>) {

  const options: Omit<UseMutationOptions<unknown, unknown, T>, 'mutationFn'> = {
    // default is to retry with linear back-off to a maximum
    retry: true,
    retryDelay: (attempt) => Math.min(attempt * 5, 30),
    // but clients may override the defaults
    ...clientOptions
  };
  const mutation = useMutation((value: T) => {
    const should = typeof shouldMutate === "function" ? shouldMutate(value) : shouldMutate;
    const mutations = should
                        ? Promise.all([
                            firebase.ref(path).update({ [prop]: value }),
                            additionalMutation ? additionalMutation(prop, value) : Promise.resolve()
                          ])
                        : Promise.resolve();

    return mutations;
  }, options);
  const throttledMutate = useMemo(() => _throttle(mutation.mutate, throttle), [mutation.mutate, throttle]);

  // If the path is empty, it could result in overwriting a large part of the DB so it is disabled.
  const setupReaction = !!path && enabled;

  useEffect(() => {
    const cleanup = setupReaction
            ? reaction(() => model[prop], value => {
                // reset (e.g. stop retrying and restart) when value changes
                mutation.isError && mutation.reset();
                throttledMutate(value);
              })
            : undefined;
    return () => cleanup?.();
  }, [setupReaction, model, mutation, prop, throttledMutate]);

  return mutation;
}
