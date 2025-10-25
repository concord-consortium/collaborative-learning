
# Firestore Metadata Migration

Between Aug 29, 2025 and Sep 21, 2025, we merged the multiple firestore metadata documents that hold info about the actual CLUE documents in the realtime database. These firestore metadata documents also include comments and history.

The logs of this migration can be found here:
s3://cc-alldata/clue/firestore-metadata-migration/

The script for the migration is in this repository at scripts/consolidate-metadata-docs.ts
The script was changed a couple of times during this period. To see which version of the script used for each log look for the version with the date just before the date of the migration log.

This migration was done for a few reasons:
- simplifies CLUE runtime code: so we don't have to check multiple places for info about a single document
- simplifies authorization logic deciding if a user should have access to comments or history

The multiple metadata documents could be:
- when a comment was created by a teacher in a CLUE network that gave them access to the document. In this case a document with a name of `[network]_[document key]` was created and the comments stored under it
- when a user edited a document the history would be stored under a document with the name `uid:[user id]_[document key]`
- when automated comments were made by AI they were stored in unprefixed document

The migration found cases where these multiple metadata documents had conflicting information. This included the context_id (class) of the document, and the title of the document. At the end the were 13 of these cases which were manually fixed and those fixes are documented below.

## Timeline

The script was run multiple times:
- Aug. 28, 2025 and ran into some problems.
- 3 times on Aug. 29, 2025: the script was updated to work around the problems.
- Sep. 3, 2025 with a fix to try to work around a firebase api error saying we were making too many requests. This fix didn't seem to work so I don't think any new documents were processed.
- Sep. 17, 2025 with a fixes to log more information and not make too many requests.
- Sep. 21, 2025 after the merge conflicts were manually resolved.
- Sep. 22, 2025 the script was updated and run on all recent demo spaces


## Merged History Problem

There is likely a problem caused by the migration which was identified after it was complete. In some cases there were history entries in multiple firestore metadata documents. The migration script just merged all of these history entries into the single unprefixed metadata document. This will probably break history playback when it encounters one of these documents. The history entries have a enough information in that that we can fix these documents, but we'll have to choose which set of history entries should be kept.

It isn't clear why two or more copies of history were recorded in different documents. The document should only have been edited by the owner of it, so the uid prefixed document should be the only one with history. However tracking down the reason would require going through the history of the code and comparing it with behavior. Now that the history entries have been merged it will be hard to recover enough information to tell what happened.

## Too many history entries problem

When the script was updated between Sep. 3  and Sep. 17, it was found that the script wouldn't handle large number of history entries. In some cases demo documents had 300,000 history entries, and the script would have tried to load all of these history entries at the same time. There used to be a limit of 10,000 documents loaded at once. Firestore has change this so it seems to be based on the number of bytes in the result not count of documents. It isn't clear if the script runs before Sep. 17, lost history entries because of this.

On the Sep. 17, the script recorded how many history entries it copied in each metadata documents. The largest number it saw was 49,832 and there were around 20 more above 20,000 history entries. So perhaps there were no previous problems.

## Tools metadata

The tools list in the metadata, which is used by the sort work tab seemed to conflict sometimes. So it is likely this list is not correct in several cases now. This seems like not to big of a deal. If the student updates the document and makes a small change, that will fix it. Or we could resurrect the old script which added this info to all of the documents original and run that again.

## Statistics from the Sep. 17 run

```
98,928 - total docs
98,890 - base docs: number of CLUE documents these metadata docs are describing
40,319 - docs that had nothing to do
58,549 - using first prefixed doc the base document
     6 - updating existing base document
    13 - docs skipped due to merge errors
15,190 - docs with history items that were copied
     9 - docs with comment items that were copied
58,571 - copied subcollections from a "uid:" document
58,571 - copied subcollections from any document
58,571 - deleted documents from a "uid:" document
58,571 - deleted documents from any document
58,549 - base docs created or merged with a "network" in them
58,549 - base docs created or merged with a "network: null" in them
```

# Running the script

On Sep 17, it was run with a command like:
```
npm exec tsx ./consolidate-metadata-docs.ts > >(tee output-scottlocal1.log) 2> >(tee error-scottlocal1.log | sed $'s/^/\033[31m/;s/$/\033[0m/')
```

On Sep 22, it was run with:
```
npm exec tsx ./consolidate-metadata-docs.ts > >(tee output-demo-2025-09-22.log) 2> >(tee output-demo-2025-09-22.log | sed $'s/^/\033[31m/;s/$/\033[0m/')
```


Previous runs used different commands.

## Notes about merge conflicts

When the script was run on Sep. 17 it reported 13 merge conflicts. It seems like all of these conflicts existed during previous runs of the script. In all cases there was a prefixed document and an unprefixed document. The unprefixed document was created or updated by a previous run of the script.

There were mismatches in:
- context_id
- title
- unit

It isn't clear how these conflicts were created. For the context_id my best guess is that previous versions of the CLUE runtime created them by recording the context id of the current user that was leaving a comment instead of the context id of the document they were commenting on. Perhaps the code still does this I didn't check.

However would be good to digging into this more because it could mean there is some runtime or function code that is creating documents with wrong context_id's and this would then probably prevent students from reading and writing to these documents.

The title conflicts were all in learning log documents whose title was updated by what looks like a researcher user.

The unit conflict was a conversion of s+s to sas which was renamed.

# Conflicting context ids

## -Mj5-mcLh93l6IVNgQuN
Two classes:
- 5c097ef6a7ff0ff2ddb2b008504477794fef02f7aef94661
  contextId of unprefixed doc,
  context_id of uid:154186 document (which has history)
  portal class id: 46380
  looks like a real class
  teacher is 154186
- 58de078434eda209a56713584dd5ba9864448a3c9dc9933d
  context_id of unprefixed doc
  portal class id: 47371
  called "CLUE Networks 2021-21"
  teacher is Leslie
  teacher id 154964

The correct context id is 5c097ef6a7ff0ff2ddb2b008504477794fef02f7aef94661
I updated context id of the unprefixed document

## -MlpnM78ef0ihSstmngZ
Two documents, both have history, both are problem docs
Only unprefixed doc has comments
uid of both: 837055

Classes:
- 79d69974edbc5e92d6d687280084d23f13b630a783f7fb0a
  context_id and contextId of prefixed doc uid:837055
  contextId of unprefixed doc
  "CLUE Sandbox1"
  portal id 47955
  teachers 837055
- 9966253b24c8f0885db6450bf2e135d6ed1d93012ada98ae
  context_id of unprefixed doc
  portal id 47956
  teachers 837056, 837076
  "CLUE Sandbox2"

The prefixed document has much more history and this history has new entries.
So I'm deleting the older unprefixed document.
There isn't a renaming option, so the prefixed doc will get moved when the script is run again.

## -MlpnMDpBSPiWdClhEPT
### Un prefixed document
Has what look like legit comments from users:
- 837056
- 837055

contextId: 79d69974edbc5e92d6d687280084d23f13b630a783f7fb0a
context_id: 9966253b24c8f0885db6450bf2e135d6ed1d93012ada98ae

no history
uid: 837055

### Prefixed doc
no comments
short history: March 14, 2023
uid: 837055
context_id: 79d69974edbc5e92d6d687280084d23f13b630a783f7fb0a

Note these are the same classes above. In that case I choose the doc with the 99 class

In this case the choice isn't very clear. Since the comments look legit I'm going to keep both docs and just fix the context_id of the unprefixed doc

## -Mlugpd-FJeyRjSFYdgL
### Unprefixed doc
contextId: 5c097ef6a7ff0ff2ddb2b008504477794fef02f7aef94661
context_id: be00842bc93d8482bb1b4026461cb975278d37abb2920a86

no history
uid: 154186
comments: just one that doesn't seem legit
network: "cc-test"
type: planning

### Prefixed doc
contextId: 5c097ef6a7ff0ff2ddb2b008504477794fef02f7aef94661
context_id: 5c097ef6a7ff0ff2ddb2b008504477794fef02f7aef94661

history: short from Nov 7, 2022
network: null
type: planning

The document exists at:
/authed/portals/learn_concord_org/classes/5c097ef6a7ff0ff2ddb2b008504477794fef02f7aef94661/users/154186/documents/-Mlugpd-FJeyRjSFYdgL

Just going to delete the unprefixed doc, it only adds the network which we are going to
ignore now, and it has the wrong context_id

## -MotNW63o5k9Oh8F27DZ
### Unprefixed doc
contextId: 9966253b24c8f0885db6450bf2e135d6ed1d93012ada98ae
context_id: 79d69974edbc5e92d6d687280084d23f13b630a783f7fb0a

type: problem
network: cc-test
comment: 2 comments from "a teacher", possibly legit, but maybe not
history: lots entries from April 7, 2023 to Aug 20, 2025
uid: 837056
teachers: 837055

The document doesn't exist in realtime database at /authed/portals/learn_concord_org/classes/79d69974edbc5e92d6d687280084d23f13b630a783f7fb0a/users/837056/documents

### Prefixed doc
contextId: 9966253b24c8f0885db6450bf2e135d6ed1d93012ada98ae
context_id: 9966253b24c8f0885db6450bf2e135d6ed1d93012ada98ae

network: null
uid: 837056
teachers: 837056
type: problem
history: lots of entries from Oct 21, 2022 to Nov 4, 2024
up through index 168 there are duplicates of each entry

The document does exist in realtime database at: /authed/portals/learn_concord_org/classes/9966253b24c8f0885db6450bf2e135d6ed1d93012ada98ae/users/837056/documents

Since these seem to be test docs and the history seems corrupt in the prefixed
doc I just deleted the prefixed doc. And then to make sure the context_id matched
the location of the document in realtime database I updated the context_id.

## -MpHkeJfWElIrInV58W3
### Unprefixed
context_id: 7c1a9b9aa3687b4706e6a1d38d29b21d6349ebfac5960f14
network: cc-test
teachers: 837055
uid: 837056

comments: these are comments by Michael on Tarens docs, both by "a teacher"
no history

### Prefixed
context_id: 9966253b24c8f0885db6450bf2e135d6ed1d93012ada98ae
(same class as above)
network: null
history: 4 entries - Jan 11, 2023

### Class
- 7c1a9b9aa3687b4706e6a1d38d29b21d6349ebfac5960f14
  portal id: 63093
  name: "2022-2023 Analytics Testing"

just deleting the unprefixed doc since it has no history and the comments are just test comments

## -NLLHUICZZ_q_isx45uA
### Unprefixed
context_id: 4ab723a463058d09ece451e05825726cd9b4c9fed7b7f9f2
network: cc-test
teachers: 837055
uid: 837056
type: planning

comments: from "a teacher" (837055), just looks like a test comment

### Prefixed
context_id: eaed5dee12ba996880aac7d9d18b6bbb73bb6ce3cec55437
teachers 837056
uid: 837056
type: planning
network: null

history: from Jan 9, 2023 Jan 19, 2023

### Classes
- 4ab723a463058d09ece451e05825726cd9b4c9fed7b7f9f2
  name: Fall 2022 Content Review
  teachers 837055
  portal id: 60846
- eaed5dee12ba996880aac7d9d18b6bbb73bb6ce3cec55437
  name: 2022-23 PD Class
  teachers 837056
  portal id: 60359

Since it is just a test comment and the second class looks like a real PD class we'll
keep that one

## -NQXRRG_an31s57mHavY
### Unprefixed
context_id: 79d69974edbc5e92d6d687280084d23f13b630a783f7fb0a
network: cc-test
teachers 837055
uid: 1120663
type: problem

comments: from user 837055, just a test comment

### Prefixed
context_id: 4d89fc10680165cd062f4bb8fa859c38a47ac56065af194c
network: null
teachers: 1120663
uid 1120663

history: from March 12, 2023 to March 14 2023

### Classes
- 4d89fc10680165cd062f4bb8fa859c38a47ac56065af194c
  name: CLUE Sandbox7
  portal id: 65422

just going to delete the unprefixed document

# Unit mismatch

## -MpgkYW_MzTkfGe1wOHT
Updated the unit to be "sas".
In both cases.

# Title mismatch

## -MotMYcTKbjVtP9icZgd
type: learningLog
both docs have history
title from realtime database: Learning Log for Inv 2
uid: 837056
The uid is listed as a a teacher of the class, so this looks like a teacher doc.

### unprefixed
history:
- Dec 14, 2022: 55 entry adding and editing the text of a tile
- Aug 22, 2024: 1 entry setting the document to be deleted

last entry is setting isDeleted to true

### prefixed
history:
- Oct 21, 2022: 4 entries (changing the title, publishing the document twice, setting text of existing text tile)
- Dec 15, 2022: 2 entries copying a tile
- Feb 25, 2023: 1 entry copying a tile

All of the history entries in these two history paths seem to have consistent previousEntryIds.
So it seems like a user was able to edit the document two different ways and the history was stored under the user in one case and not under the user in the other case.

The unprefixed document was created by the migration script when it moved cc-test_-MotMYcTKbjVtP9icZgd to -MotMYcTKbjVtP9icZgd

But when it did this move there was no recording of the merge issue. My guess is that the error log from these runs was not recorded.

So somehow there was history being written to this cc-test network document. Perhaps in the log manager we could see whether this was the actual owner of the doc or someone else. I'm pretty sure CLUE would only write to uid: prefixed docs for history

It is possible though that we are recording history entries even though we aren't actually saving the document. So for example a networked teacher figured out how to edit someone else's document. We didn't save those changes in the actual document content. But the realtime database metadata does record the document as deleted.

Just to wrap this up I'm going to delete the unprefixed document. The prefixed document has more history. It is missing the delete action though.  It seems like the history entries would be inconsistent anyhow since they overlap.

## -NHy7tk3rWuhcqo-NTiX
title from realtime database is Summaries Page

unprefixed doc has a a single history history entry from Nov 28, 2022 setting the title to "Problem 0 Summary"
prefixed doc has lots of history entries from Nov 29, 2022 to Nov 29, 2022

This one is pretty clear. I'm just going to delete the unprefixed doc

## -NHyv_LAzjKEXZAOqroS
title from realtime database is Summaries Page

unprefixed doc history with 3 entries from Nov 28, 2022
prefixed doc history with 102 entreis from Nov 29, 2022

same thing here with more history and the correct title, I'm going to keep the prefixed doc

## -NHzGqCeYM1RI2_3XaZi
this is the same as the 2 above.
I'm going to delete the unprefixed doc
