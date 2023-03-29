CLUE includes a CMS which can be accessed at `/admin.html`. It uses [Decap CMS](https://decapcms.org/). It is configured to edit the content in `clue-curriculum` repository. It can be configured with the following URL params:
- **`curriculumBranch`** By default the CMS edits the `author` branch. You can change the branch by passing a different branch name to this parameter. The CMS will not create this branch for you. You'll need to create it yourself.
- **`unit`** By default the CMS displays all of the units at the same time. It is better to work with a single unit at a time by using the `unit` param. It should be passed the unit code. This limits what is displayed in the CMS and it also configures the media library to show the images from that unit.
- **`localCMSBackend`** By default the CMS works with the `github` backend. This means even when doing local CLUE development the CMS will update the `clue-curriculum` repository directly. If you add the `localCMSBackend` parameter the CMS will attempt to work with a local git proxy running at localhost:8081. You can start this proxy with:

  `cd ../clue-curriculum; npx netlify-cms-proxy-server`

# Authorization
The github backend used by the CMS requires a GitHub OAuth app and small service to handle getting a token from GitHub so the browser can talk directly to the GitHub API.

The OAuth app is: [Concord Consortium CMS](https://github.com/organizations/concord-consortium/settings/applications/2137890)

We are using a firebase function for the service. It is deployed to:
https://console.firebase.google.com/project/cms-github-auth/overview

The code for this function is located here: https://github.com/Herohtar/netlify-cms-oauth-firebase

It was configured with the client ID and client secret from the GitHub OAuth app.

# Known Issues

## Backup Draft
The CMS has a feature for saving a draft of your work locally before you publish. If the page crashes or you reload the window without publishing, when you return the page the CMS will ask if you want to restore this draft. Unfortunately this doesn't work all of the time. If the entry you are looking at behind the dialog asking to restore the draft says it is "loading", then it typically won't work.

As far as we can tell what happens is when the entry is loaded two async functions are started. One is loading the backup draft, the other is downloading the real entry from GitHub (or whatever backend you've configured). If the backup draft function completes first, the dialog will block the real entry loading from continue. If you say yes to restore the backup draft, it will be restored, but then the real entry loading will complete. When the real entry loading completes it replaces the backup draft with the real entry essentially blowing away your backup draft.

If you are lucky and the real entry loads first, you will see this real entry behind the dialog asking about the backup draft. In this case if you choose to restore the backup draft it will stick.

This issue describes basically the same problem: https://github.com/decaporg/decap-cms/issues/5055

The place to look in the Decap code is the Editor component: `packages/netlify-cms-core/src/components/Editor/Editor.js`.
In its `componentDidMount` function, you can see it call `retrieveLocalBackup` and then call `loadEntry`. Those are the 2 async functions. When the `retrieveLocalBackup` completes it will cause the Editors props to change which will trigger `componentDidUpdate`. In `componentDidUpdate` if the `localBackup` property is toggled on then the confirm dialog is shown. And if the user confirms then `loadLocalBackup` is called. This sets the `entryDraft.entry` to the backup contents. When `loadEntry` completes it also sets `entryDraft.entry` to the loaded entry.

A possible fix would be to delay the call to `retrieveLocalBackup` until `loadEntry` has either completed successfully or it was not successful at finding an entry. This way it would not be possible for `loadEntry` to come in later and replace the entry.

A useful way to confirm this behavior is to add console logs in ClueControl when the component is initialized and when when it is rendered and when it calls the CMS's onChange. It is also useful to look at the contents of the CMS's backup. That can be found in the browser Developer tools: `Application/IndexDB/localforage/keyvaluepairs`. In this database search for keys starting with `backup`.

## Nested collection uppercase paths
The Decap nested collection implementation will lower case the path after publishing an entry if a "customPath" is setup. This happens in this function `slugFromCustomPath`. A customPath is configured with a line like:
`meta: { path: { widget: "string", label: "Path", index_file: "content" } }` in the CMS config. That meta line makes the path to the entry visible to the user and allows them to change it. But the problem with this is that causes the slug to be lowercased which then in turn causes errors with the GitHub backend because the slug is used to figure the path to request. GitHub is case sensitive so a lowercased path will not be found.

I think the right fix is to change `slugFromCustomPath` to not create a lowercased slug. However if we are going to try to use the PR which adds support for flat folders it might take care of this problem.

The short term solution is to remove the `meta...` property from the config. This configure seems like it isn't needed. I suspect it was added so we could specify the `index_file`. However it seems to work without configuration. I'd guess it just loads which ever file it finds in the directory.

# Wishlist

## More flexible nested collection support
We are using the [nested collection beta feature](https://decapcms.org/docs/beta-features/#nested-collections) of Decap. It allows authors to edit a nested set of folders containing the content. However it requires that each folder only contains a single file and the file has the same name. CLUE uses `content.json` for this filename. It would be better if a folder could contain multiple files with different names. There has been work in Decap towards this:
- https://github.com/decaporg/decap-cms/issues/4972
- https://github.com/decaporg/decap-cms/pull/6498

## Mixed entry types in nested collections
Our units have investigations, problems, and sections. We have broken apart the sections into separate files. It would be nice if we broke apart the other levels as well. That way information from these levels could be used by the CMS at least for naming and possibly ordering.

## Ordering in nested collections
The levels of hierarchy of a unit have an order defined by their parent object. It would be useful if the tree shown by the nested collection could be ordered based on this. This seems tricky since the nested collection is based just on the folder structure, and if we started putting multiple files in a single folder, it wouldn't be obvious which file in a parent folder is the parent of the current entry.
