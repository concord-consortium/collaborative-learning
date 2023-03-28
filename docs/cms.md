CLUE includes a CMS which can be accessed at `/admin.html`. It uses [Decap CMS](https://decapcms.org/). It is configured to edit the content in `clue-curriculum` repository. By default it edits the `author` branch. You can change the branch by passing a `curriculumBranch` parameter to admin.html.  By default it displays all of the units at the same time. It is better to work with a single unit at a time by using the `unit` param. This limits what is displayed in the CMS and it also configures the media library to show the images from that unit.

# Known Issues

## Backup Draft
The CMS has a feature for saving a draft of your work locally before you publish. If the page crashes or you reload the window without publishing, when you return the page the CMS will ask if you want to restore this draft. Unfortunately this doesn't work all of the time. If the entry you are looking at behind the dialog asking to restore the draft says it is "loading", then it typically won't work.

As far as we can tell what happens is when the entry is loaded two async functions are started. One is loading the backup draft, the other is downloading the real entry from GitHub (or whatever backend you've configured). If the backup draft function completes first, the dialog will block the real entry loading from continue. If you say yes to restore the backup draft, it will be restored, but then the real entry loading will complete. When the real entry loading completes it replaces the backup draft with the real entry essentially blowing away your backup draft.

If you are lucky and the real entry loads first, you will see this real entry behind the dialog asking about the backup draft. In this case if you choose to restore the backup draft it will stick.

This issue describes basically the same problem: https://github.com/decaporg/decap-cms/issues/5055

The place to look in the Decap code is the Editor component: `packages/netlify-cms-core/src/components/Editor/Editor.js`.
In its `componentDidMount` function, you can see it call `retrieveLocalBackup` and then call `loadEntry`. Those are the 2 async functions. When the `retrieveLocalBackup` completes it will cause the Editors props to change which will trigger `componentDidUpdate`. In `componentDidUpdate` if the `localBackup` property is toggled on then the confirm dialog is shown. And if the user confirms then `loadLocalBackup` is called. This sets the `entryDraft.entry` to the backup contents. When `loadEntry` completes it also sets `entryDraft.entry` to the loaded entry.

A possible fix would be to delay the call to `retrieveLocalBackup` until `loadEntry` has either completed successfully or it was not successful at finding an entry. This way it would not be possible for `loadEntry` to come in later and replace the entry.


