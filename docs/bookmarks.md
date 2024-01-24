
# Implementation Notes:

Previously only certain stars were synced:
- personal documents loaded by the `db-other-docs-listener` stars were sync'd
- problem documents that are owned by the current user stars were sync'd
- publication document stars were sync'd

It seemed best to just sync all of the stars. So if the UI lets a user change a star, then that star will be saved in the database.

We are counting on the short circuit of both Firebase and MobX to prevent infinite update loops. Here are some cases:
- **Local user changes a star** That will trigger the `syncStars` reaction. This will update Firebase which will trigger the `handleUpdateStars` Firebase listener. That will update the  MobX model. `[CHECK]` Because nothing has changed in the MobX model the reaction will not be triggered again.
- **Remote user changes a star** That will trigger `handleUpdateStars`. This will update the MobX model. That will trigger the MobX reaction. This will update Firebase but because the update is not really changing the data in Firebase it will not trigger the Firebase listener.
- **Local user adds a new star** That will trigger the MobX reaction. This will add the star to Firebase and update the MobX model with the new star id. The Firebase listener will be triggered and MobX reaction will be triggered again. The MobX reaction will try to update Firebase again, but the data in Firebase won't be changed. The Firebase listener will update the MobX model but it won't really change it.

# Optimizations

We could short circuit the "new star" case further by not including the star key in the value of the reaction. The key of the star would have to be looked up by the effect function of the reaction based on the uid.

We could also using the structural comparer in the reaction. This way even if a MobX model change triggered the reaction if the value doesn't change then it won't trigger the effect. We could also use the previousValue in the effect function to see what was changed and use that to optimize things.

Another optimization option is to add the reaction to each individual star instead the whole map. This seems like a lot of observers but it is not that much different than all of the thumbnail components observing each of the stars.

# How to represent multiple bookmarks on a single doc

If we want to continue to show bookmarks made by anyone to everyone here is my proposal:
- have 4 groups of bookmarks in the sort work tab: you, teacher, others, none
- add dots to the bookmark to indicate you, teacher, others

Other options:
- add a rollover to the bookmark

Some use cases:
- you want to bookmark some document even though the teacher did, because the teacher is in the habit of removing bookmarks after that document isn't relevant anymore
- so you still need to toggle your own bookmark of this document

