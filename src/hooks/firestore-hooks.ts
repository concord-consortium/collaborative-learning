import firebase from "firebase/app";
import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, UseQueryOptions } from 'react-query';
import { useDBStore } from './use-stores';

export type WithId<T> = T & { id: string };

export function useFirestore() {
  const db = useDBStore();
  let root = db.firestore.getRootFolder();
  // remove trailing slash
  if ((root.length > 1) && (root[root.length - 1] === "/")) {
    root = root.slice(0, root.length - 1);
  }
  return [db.firestore, root] as const;
}

// https://medium.com/swlh/using-firestore-with-typescript-65bd2a602945
const defaultConverter = <T>(): firebase.firestore.FirestoreDataConverter<T> => ({
  toFirestore: (data: T) => data,
  fromFirestore: (doc: firebase.firestore.QueryDocumentSnapshot) => doc.data() as T
});

export interface IUseOrderedCollectionRealTimeQuery<T> {
  converter?: firebase.firestore.FirestoreDataConverter<T>;
  orderBy?: string;
  useQueryOptions?: UseQueryOptions<WithId<T>[]>;
}
export function useCollectionOrderedRealTimeQuery<T>(
          partialPath: string, options?: IUseOrderedCollectionRealTimeQuery<T>) {
  const { converter = defaultConverter<T>(), orderBy, useQueryOptions: _useQueryOptions } = options || {};
  const queryClient = useQueryClient();
  const [db, root] = useFirestore();
  const fsPath = partialPath ? `${root}/${partialPath}` : "";

  useEffect(() => {
    // use Firestore real-time listener to update query data automatically
    // cf. https://aggelosarvanitakis.medium.com/a-real-time-hook-with-firebase-react-query-f7eb537d5145
    // TODO: share a listener instance across hook instances rather than having multiple listeners
    if (fsPath) {
      const ref = db.collectionRef(fsPath).withConverter(converter);
      const query = orderBy ? ref.orderBy(orderBy) : ref;
      const unsubscribe = query.onSnapshot(querySnapshot => {
                            // add the id to the returned data
                            const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                            queryClient.setQueryData(fsPath, docs);
                          });
      return () => unsubscribe();
    }
  }, [converter, db, fsPath, options?.orderBy, orderBy, queryClient]);

  // set staleTime to Infinity; we never need to re-run this query, since the listener handles updates
  const useQueryOptions: UseQueryOptions<WithId<T>[]> = { ..._useQueryOptions, staleTime: Infinity };
  // the actual query function here doesn't do anything; everything comes through the snapshot handler
  return useQuery<WithId<T>[]>(fsPath || "__EMPTY__", () => new Promise(() => {/* nop */}), useQueryOptions);
}

export const useDeleteDocument = () => {
  const [firestore] = useFirestore();
  const deleteDocument = useCallback((partialPath: string) => {
    return firestore.doc(partialPath).delete();
  }, [firestore]);
  return useMutation(deleteDocument);
};
