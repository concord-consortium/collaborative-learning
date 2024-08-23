# Firestore database structure

## Top level collections

These are similar to Firebase.

`authed, demo, dev, qa, tests, users`

Within `authed`, there are several portal site names:

- `learn_concord_org` (production)
- `learn_portal_staging_concord_org`
- `learn_staging_concord_org`
- `learn-migrate_concord_org` (not sure of status, has only `documents`)

Within `demo`, the names of demo spaces (eg, "CLUE")

Within `dev`, UUIDs of dev instances.

Within `qa`, UUIDs of test instances.

`tests` is something different, doc TODO.

`users` top level collection looks like a mistake.

## Second level

Collections within `(authed|demo|dev|qa)/{id}`:

- classes
- curriculum
- documents
- images
- mcimages
- mcsupports
- offerings
- users

## Third level

### Contents of `classes/{classDocId}`

Currently we are storing class docs under both of these `classDocId`s:

- classes/{network}_{contextid}
- classes/{contextid}

Fields:

- id (string)
- name (string)
- context_id (string, uuid)
- network: (string, name of network)
- teacher: (string, full name of teacher who created it)
- uri: (uri on the portal)
- teachers: (array of IDs of teachers)

### Contents of `curriculum/{docPath}`

TODO

### Contents of `documents/{docId}`

Fields:

- key: (string, the id of the document in firebase)
- title: (string)
- type: (string, eg "problem")
- uid: (string).  TODO: determine if this is the owner of the document, the owner of the comments, or sometimes either.
- contextId: (currently ignored; see `DocumentModel.metadata()`)
- context_id: (string, uuid, should match context_id of a class)
- createdAt: (timestamp)
- network: (string, name of a network)
- originDoc: (string, if set = key of the original document that created this PublishedDocument)
- properties: (map, eg { pubCount: 1 })
- teachers: (array of user IDs) _should be removed_

Collection:

- comments
- history

#### Contents of `documents/{docId}/comments/{commentId}`

- content
- createdAt (date & time)
- name: (full name)
- network (network name)
- tileId: (string, mobx id)
- uid: (string)
- tags: (array of strings)

### images, mcimages, mcsupports, offerings, users

TODO
