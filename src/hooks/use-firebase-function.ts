import firebase from "firebase/app";

/*
 * useFirebaseFunction
 *
 * Returns a type-aware function that calls the firebase function under the hood.
 * The first time this hook is used in a session it issues a warm-up request to
 * mitigate the Firebase function cold-start issue.
 * For obvious reasons, this should only be used with firebase functions that
 * support the warm-up protocol ({ warmUp: true }).
 */
const cachedFunctions = new Map<string, firebase.functions.HttpsCallable>();

export function getFirebaseFunction<T>(name: string) {
  let callableFunction = cachedFunctions.get(name);
  if (!callableFunction) {
    callableFunction = firebase.functions().httpsCallable(name);
    cachedFunctions.set(name, callableFunction);
    // issue warm-up request
    callableFunction({ warmUp: true });
  }
  return callableFunction as (params: T) => Promise<firebase.functions.HttpsCallableResult>;
}

export function useFirebaseFunction<T>(name: string) {
  return getFirebaseFunction<T>(name);
}
