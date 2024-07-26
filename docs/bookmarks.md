# Bookmarks Notes

Bookmarks used to be called stars.

The bookmarks are stored in Firebase at:
`<class root>/offerings/<offering id>/commentaries/stars/<doc id>/<star id>`.

Underneath that path is a star object that looks like:
```
{
  starred: boolean,
  timestamp: number,
  uid: string // User id that added this star or bookmark
}
```

A couple of nuances here:
- the presence of a star object doesn't mean the document is bookmarked, the starred property of this object has to be true
- the stars are stored under the offering. If a user bookmarks a personal document, that bookmark will only be seen on that personal document when the user opens the same assignment from the portal.

The bookmarks are managed by `models/stores/bookmarks.ts` and `lib/db-listeners/db-bookmarks-listener.ts`.

`bookmarks.ts` uses Firebase as the source of truth. So when a user changes a star that star is changed in Firebase directly. The change in Firebase is picked up by `db-bookmark-listener.ts` which then updates the bookmarks MobX model in `bookmarks.ts`. Firebase triggers listeners like this immediately even when offline, so this approach of using Firebase as the source of truth does not add extra time. The single source of truth keeps the code less complex.

`db-bookmark-listener.ts` listens to changes in `<class root>/offerings/<offering id>/commentaries/stars/`. There is a single Firebase listener for all of the offering's bookmarks.

Before Feb 2024, only certain bookmarks were updated in Firebase:
- personal documents loaded by the `db-other-docs-listener` bookmarks were sync'd
- problem documents that are owned by the current user bookmarks were sync'd
- publication document bookmarks were sync'd
Document types not in that list would not sync their bookmarks.
The `v5.2.0` release fixed this and now all bookmarks are updated in Firebase.

# Debugging

The UI shows a bookmark on the document when any user has bookmarked the document. When a user clicks the bookmark CLUE toggles that user's bookmark on that document. If the user doesn't have a bookmark yet, then one is added. This user bookmark will be added even if the document is already showing a bookmark from a different user. All of this can be confusing.

To expose this confusing logic the debug option `bookmarks` can be used. It will show a code above the bookmark on the thumbnail of the document. Like `U1 T1 O1`.
- `U1` means the current user has a bookmark for the document
- `T1` means 1 teacher other than you has a bookmark for the document
- `O1` means 1 other user in the class has a bookmark for the document
The numbers will increase if more than one teacher or other user has bookmarked the document.

Additionally the `bookmarks` debug option will console log a message when the bookmark is clicked. This message includes all of the bookmarks on the document prior to the click.

# How to represent multiple bookmarks on a single doc

If we want to continue to show bookmarks made by anyone to everyone here is my proposal:
- have 4 groups of bookmarks in the sort work tab: you, teacher, others (or other students), none
- add some indication to the bookmark to indicate who has bookmarked it: you, teacher, others. You can see a rough demo of this with the debugging option described above.

## Why you might want to bookmark something the Teacher already has:
You want to bookmark some document even though the teacher did, because the teacher tends to remove bookmarks after that document isn't relevant anymore, and you want to keep track of it. So you still need to toggle your own bookmark of this document.

## Why the teacher might not want to see bookmarks from other class members
They might curate the bookmarks for the class so if anyone can bookmark stuff the teacher will lose control. Without the separate grouping, the teacher would have no way to hide other student bookmarks.

## Why have a teacher bookmark section
If there is more than one teacher in the class, each of them might want to control this list of bookmarks. Even with improved display of the bookmarks, this case isn't handled well. If Teacher A has bookmarked a document, then Teacher B cannot un-bookmark it. This means the document would still continue to show in the teacher bookmark section.

# Suggestions for Future Improvements
- rename all references to `stars` to `bookmarks`.
- remove the flag of `starred` on the star in Firebase, and just use the presence of the star.
- move the bookmarks to Firestore, they fit the firestore model better because we can query them for the ones owned by a user and ones owned by a teacher.
- make bookmarks independent of the offering so a document bookmarked is bookmarked for all offerings in the class. It isn't clear if this is really what a user would want, but it probably is.

# Use of ts-jest-mocker

To get the typescript mocking to work properly for MobX classes, we need the function below to return false. This is a function in MobX. Without changes it will return true because the constructor of prototype of the mocked object provided by ts-jest-mocker matches `Object.toString()`.
```
function isPlainObject(value) {
  if (!isObject(value)) {
    return false;
  }

  var proto = Object.getPrototypeOf(value);

  if (proto == null) {
    return true;
  }

  var protoConstructor = Object.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof protoConstructor === "function" && protoConstructor.toString() === plainObjectString;
} // https://stackoverflow.com/a/37865170
```

This issue is worked around in the test by calling `Object.setPrototypeOf(mock, ClassBeingMocked);`
This issue could probably be fixed within ts-jest-mocker by defining the getPrototypeOf() on the handler in its createClassProxy.
