CLUE keeps track of loaded documents using `DocumentsModel` instances, I'll call them registries for short.

There are two registries in a CLUE application:
- `documents`
- `networkDocuments`

These two instances are created by `createStores`, which is called by `initializeApp`.
`initializeApp` is called one time globally when `index.tsx` is loaded.

Documents are added to the registry via an `add` action. This makes sure there isn't a document already added to the registry with the same key. It will print a console warning if a document exists with the same key.

Documents are added to the `networkDocuments` registry in `network-resources.ts`.
Documents are added to the `documents` registry in `db.ts` and `supports.ts`

From what I can tell with the code it is possible to have multiple document instances of the same document at the same time. However there will only be one in the documents registry. So the extra documents could be seen as orphans. While experimenting with the application I could not make this case happen. This case of multiple documents with the same key will cause problems if unexpected. This is why there is now a warning printed when a second doc is added to the registry with the same key.

## Issues

We are planning to support rendering documents that are not part of the registry. This will be used for the time travel slider.  Here are some places that will be a problem:

- `DataflowToolCompoent.getDocument` - this is assuming the document of this dataflow tool is the primary document of the stores.  That will not be the right document if it is being rendered in a document on the left. It will also be a problem with the time travel slider.

