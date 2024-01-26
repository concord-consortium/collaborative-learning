# Implementation Notes:

Previously only certain bookmarks were updated in Firebase:
- personal documents loaded by the `db-other-docs-listener` bookmarks were sync'd
- problem documents that are owned by the current user bookmarks were sync'd
- publication document bookmarks were sync'd

This was changed to update in Firebase any star the user can change in the UI.

The bookmarks use Firebase as the source of truth. So when a user changes a star that star is changed in Firebase directly. The change in Firebase causes an update to the bookmarks MobX model. Firebase triggers these changes immediately even when offline so this approach should not add extra time, and it makes the code more simple.

# Debugging

The UI shows a bookmark on the document when any user has bookmarked the document. When a user clicks the bookmark CLUE toggles that user's bookmark on that document. If the user doesn't have a bookmark yet, then one is added. This user bookmark will be added even if the document is already showing a bookmark from a different user. All of this can be confusing.

To expose this confusing logic the debug option `bookmarks` can be used. It will show a code above the bookmark on the thumbnail of the document. Like `U1 T1 O1`.
- `U1` means the current user has a bookmark for the document
- `T1` means 1 teacher other than you has a bookmark for the document
- `O1` means 1 other user in the class has a bookmark for the document
The numbers will increase if more than one teacher or other user has bookmarked the document.

Additionally the `bookmarks` debug option will console log a message when the bookmark is click. This message includes all of the bookmarks on the document prior to the click.

# How to represent multiple bookmarks on a single doc

If we want to continue to show bookmarks made by anyone to everyone here is my proposal:
- have 4 groups of bookmarks in the sort work tab: you, teacher, others(or other students), none
- add some indication to the bookmark to indicate who has bookmarked it: you, teacher, others. You can see a rough demo of this with the debugging option described above.

## Why you might want to bookmark something the Teacher already has:
You want to bookmark some document even though the teacher did, because the teacher tends to removing bookmarks after that document isn't relevant anymore, and you want to keep track of it. So you still need to toggle your own bookmark of this document.

## Why the teacher might not want to see bookmarks from other class members
They might curate the bookmarks for the class so if anyone can bookmark stuff the teacher will lose control. Without the separate grouping, the teacher would have no way to hide other student bookmarks.

## Why have a teacher bookmark section
If there is more than one teacher in the class, each of them might want to control this list of bookmarks. Even with improved display of the bookmarks, this case isn't handled well. If Teacher A has bookmarked a document, then Teacher B cannot un-bookmark it. This means the document would still continue to show in the teacher bookmark section.

# Improvements
- rename all references to `stars` to `bookmarks`
- remove the flag of `starred` on the star in Firebase, and just use the presence of the star.
- move the bookmarks to Firestore, they fit the firestore model a better because we can query them for the ones owned by a user and ones owned by a teacher.
- make bookmarks independent of the offering so a document bookmarked is bookmarked for all offerings in the class. It isn't clear if this is really what a user would want, but it might be.


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
