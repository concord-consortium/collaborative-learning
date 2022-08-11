CLUE keeps track of loaded documents using `DocumentsModel` instances, I'll call them registries for short.

There are two registries in a CLUE application:
- `documents`
- `networkDocuments`

These two instances are created by `createStores`, which is called by `initializeApp`.
`initializeApp` is called one time globally when `index.tsx` is loaded.

Documents are added to the registry via an `add` action. This makes sure there isn't a document already added to the registry with the same key. However it does not provide a warning if there is one it just silently doesn't add it. 

Documents are added to the `networkDocuments` registry in `network-resources.ts`.
Documents are added to the `documents` registry in `db.ts` and `supports.ts`

From what I can tell with the code it is possible to have multiple document instances of the same document at the same time. However there will only be one in the documents registry. So the extra documents could be seen as orphans.
