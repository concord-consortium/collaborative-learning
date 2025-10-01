# Rollbar Metadata Errors

We've been getting a lot of rollbar errors for years about missing metadata documents in Firebase.

Most of the time these docs are in demo space. Over a few days in Sept. 2025 Scott manually cleaned up several of these documents. The details are below.

We could write a script to find these issues and clean them up. Since they are happening in demo space it is likely they have also happened in other places, and we just haven't identified it. Most of the documents that were cleaned up hadn't been modified since 2023, so hopefully this isn't a current problem. But we don't know that for sure.

The best long term fix would be to remove the Realtime database metadata files, and just use the Firestore metadata files. Currently there are 2 or 3 different metadata locations across the realtime database and firestore that have to be kept in sync. By only using Firestore that would be just be one location.

# Notes for doing this again

The "issues" in rollbar do not match up with the document ids. The title of the issue has a specific document id, but then Rollbar groups errors from other documents under this issue. So you need to look at the "occurrences" of the issue to find all of the document ids, and details about each document id.

The case that caused the most errors was when demo user 1001 loaded up CLUE then it would try to load 10 documents with missing metadata.

For each error you need information in order to find all of the places the document should have an entry:
- document id or key
- type of document
- user id
- demo space
- classname
- offering

The old error messages have the document id, type of document, and user id. The new error messages should have more info.

For the old error messages:
- the demo space can be found by looking at the request URL recorded by Rollbar
- the classname and offering can be found by looking at the Rollbar params for an occurrence.

The documentation file `document-types.md` describes where all of the metadata is stored in the realtime database. It is different for each document type.


For easier reference, here is a more concise version for a few common document types. If the document isn't in `CLUE` demo space and `democlass1` class you will need to update those parts of the path.

Additionally each document might have a metadata in Firestore including comments and history. This can be found at `/demo/CLUE/documents/`

## Problem document
- `/demo/CLUE/portals/demo/classes/democlass1/offerings/[offering]/users/[user-id]/documents/`
- `/demo/CLUE/portals/demo/classes/democlass1/users/[user-id]/documents/`
- `/demo/CLUE/portals/demo/classes/democlass1/users/[user-id]/documentMetadata/`

## Personal Publications
- `/demo/CLUE/portals/demo/classes/democlass1/personalPublications` **important** the name of the entry in this location will be slightly different from the document id or key. Usually the first 5 characters are the same. If you open this entry it will have a key value inside of the self child that will match the actual document id exactly.
- `/demo/CLUE/portals/demo/classes/democlass1/users/[user-id]/documents/`
- `/demo/CLUE/portals/demo/classes/democlass1/users/[user-id]/documentMetadata/`

# Notes about manually fixed documents

These notes are here in case we want to write a script to clean this up. Or we need to track down some issue caused by this clean up.

## -MzLB31Bip9Y47Wz9IHK
https://app.rollbar.com/a/concordconsortium/fix/item/CLUE/1339
https://app.rollbar.com/a/concordconsortium/fix/item/CLUE/2626
https://app.rollbar.com/a/concordconsortium/fix/item/CLUE/2649

user: 1001, demo: CLUE, type: personalPublication

No firestore

Existed at:
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-MzLB38iNo06V5OpyCca

Doesn't exist at:
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-MzLB31Bip9Y47Wz9IHK

Doc deleted (I think 2025-09-07):
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-MzLB31Bip9Y47Wz9IHK

Doc deleted (2025-09-09)
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-MzLB38iNo06V5OpyCca

## -NWxhRwSH_xCuH71Rk1x
https://app.rollbar.com/a/concordconsortium/fix/item/CLUE/1332
https://app.rollbar.com/a/concordconsortium/fix/item/CLUE/2632

user: 8, demo: CLUE, type: problem, offering: 1

no firestore

I found this in:
/demo/CLUE/portals/demo/classes/democlass1/offerings/1/users/8/documents/-NWxhRwSH_xCuH71Rk1x

This document doesn't have an entry either in the
/demo/CLUE/portals/demo/classes/democlass1/users/8/documents/-NWxhRwSH_xCuH71Rk1x
/demo/CLUE/portals/demo/classes/democlass1/users/8/documentMetadata/-NWxhRwSH_xCuH71Rk1x

## -NNCO8iO3vGrZAdnppln

https://app.rollbar.com/a/concordconsortium/fix/item/CLUE/1332
https://app.rollbar.com/a/concordconsortium/fix/item/CLUE/2640

user 1001, CLUE demo space, type: personalPublication, offering: mothed301

no firestore

Exists at:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-NNCO8iO3vGrZAdnppln
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-NNCO8jwHDcm9o-qS_0y

not at:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documentMetadata/-NNCO8iO3vGrZAdnppln
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-NNCO8iO3vGrZAdnppln

deleted (I think on 2025-09-07)
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-NNCO8iO3vGrZAdnppln

deleted on 2025-09-09:
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-NNCO8jwHDcm9o-qS_0y

## -NnjhEUmbV9pbo6DXgUF

user: 1001, type: personal, demo: CLUE, offering: msa201, class: democlass1

Existed at:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/personalDocs/-NnjhEUmbV9pbo6DXgUF

Not at:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documentMetadata/-NnjhEUmbV9pbo6DXgUF
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-NnjhEUmbV9pbo6DXgUF

no firestore doc

deleted 2025-09-09:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/personalDocs/-NnjhEUmbV9pbo6DXgUF

## -MJh5LBuNliLYdIUWIFj

/demo/CLUE/portals/demo/classes/democlass1/users/8/documentMetadata/-MJh5LBuNliLYdIUWIFj
user 8, type: personalPublication, demo: CLUE

no firestore

not exist:
/demo/CLUE/portals/demo/classes/democlass1/users/8/documents/-MJh5LBuNliLYdIUWIFj

exists:
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-MJh5LE-HxjC-XouDaFr

deleted at 2025-09-09
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-MJh5LE-HxjC-XouDaFr

## -M_0iyG8eAL19uUzDMmo

/demo/CLUE/portals/demo/classes/democlass1/users/1001/documentMetadata/-M_0iyG8eAL19uUzDMmo
user 1001, type: personalPublication, demo: CLUE

no firestore

exists:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-M_0iyG8eAL19uUzDMmo
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-M_0iyHrGWzCqoCI65__

deleted 2025-09-09:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-M_0iyG8eAL19uUzDMmo
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-M_0iyHrGWzCqoCI65__

## -M_0jb8biPgoCc06uHrn

/demo/CLUE/portals/demo/classes/democlass1/users/1001/documentMetadata/-M_0jb8biPgoCc06uHrn
user 1001, type: personalPublication, demo: CLUE

no firestore

exists:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-M_0jb8biPgoCc06uHrn
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-M_0jbANK1jUNSJ0VS71

deleted on 2025-09-09:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-M_0jb8biPgoCc06uHrn
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-M_0jbANK1jUNSJ0VS71

## -NAPuHBR1i-TgejtL5ia

/demo/CLUE/portals/demo/classes/democlass1/users/1001/documentMetadata/-NAPuHBR1i-TgejtL5ia
user 1001, type: personalPublication, demo: CLUE

no firestore

exists:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-NAPuHBR1i-TgejtL5ia
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-NAPuHD_O-YJX-CdTn4N

deleted on 2025-09-09:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-NAPuHBR1i-TgejtL5ia
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-NAPuHD_O-YJX-CdTn4N

## -NAQETbcWVvtMjJ3Rc-7

/demo/CLUE/portals/demo/classes/democlass1/users/1001/documentMetadata/-NAQETbcWVvtMjJ3Rc-7
user 1001, type: personalPublication, demo: CLUE

no firestore

exists:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-NAQETbcWVvtMjJ3Rc-7
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-NAQETr1fic7Tb8DYY_q

deleted on 2025-09-09
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-NAQETbcWVvtMjJ3Rc-7
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-NAQETr1fic7Tb8DYY_q

## -NVZTsxPo5ejGQhSC5nX

/demo/CLUE/portals/demo/classes/democlass1/users/1001/documentMetadata/-NVZTsxPo5ejGQhSC5nX
user 1001, type: personalPublication, demo: CLUE

no firestore

exists:
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-NVZTsxPo5ejGQhSC5nX
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-NVZTt84i6PKoJoaCFuM

deleted on 2025-09-09
/demo/CLUE/portals/demo/classes/democlass1/users/1001/documents/-NVZTsxPo5ejGQhSC5nX
/demo/CLUE/portals/demo/classes/democlass1/personalPublications/-NVZTt84i6PKoJoaCFuM

## -MDV9TKVdpYFpcKfW-Cb

/demo/CLUE/portals/demo/classes/democlass1/users/8/documentMetadata/-MDV9TKVdpYFpcKfW-Cb
user: 8, type: problem, demo: CLUE, offering: msa201

Because this is from local info the offering isn't clear but the URL to load it is:
http://localhost:8080/?appMode=demo&demoName=CLUE&fakeClass=1&fakeUser=student:5&problem=2.1&unit=msa

no firestore

exists:
/demo/CLUE/portals/demo/classes/democlass1/offerings/msa201/users/8/documents/-MDV9TKVdpYFpcKfW-Cb

## -N56zUtFW_06E04Pb25K
type:publication
offering: sas1
class: democlass1
uid: 8 (1@demo)

Deleted the document in:
/demo/CLUE/portals/demo/classes/democlass1/offerings/sas1/publications/
(name is slightly different but the `key` value of object matches id)
Did not exist in
- /demo/CLUE/portals/demo/classes/democlass1/documentMetadata
- /demo/CLUE/portals/demo/classes/democlass1/documents
- /demo/CLUE/portals/demo/classes/democlass1/learningLogs
- /demo/CLUE/portals/demo/classes/democlass1/personalDocs

No doc in Firestore

## -MDQX1s3E_tSfJl-b-uZ
type:problem
offering:sas1
class:democlass1
uid: 8 (2@demo)

Deleted all of
/demo/CLUE/portals/demo/classes/democlass1/offerings/sas1/users/8
Only had 1 document.

Did not exist in
/demo/CLUE/portals/demo/classes/democlass1/users/8/documentMetadata/

Lots of history in Firestore
Deleted Firestore doc

## -NCZzF8y3PrYFqAJ13tu
type:problem
offering:m2s101
class:democlass1
uid: 8

Deleted all of
/demo/CLUE/portals/demo/classes/democlass1/offerings/m2s101/users/8
Did not exist in documentMetadata

Lots of history in Firestore
Deleted Firestore document

## -NV1Eyd_XYR-IaEgPKrZ
type:problem
offering:mods101
class:democlass1
uid:8
Deleted all of
/demo/CLUE/portals/demo/classes/democlass1/offerings/mods101/users/8
Did not exist in documentMetadata

Did not exist in Firestore.

## -NW7db6NBPHnvYcd-Vwf
type:problem
offering:msa101
class:democlass1
uid:8

Deleted all of
/demo/CLUE/portals/demo/classes/democlass1/offerings/msa101/users/8
Did not exist in documentMetadata
Found doc in Firestore and deleted it.
