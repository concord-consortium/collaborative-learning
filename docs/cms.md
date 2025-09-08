# CLUE CMS

CLUE includes a CMS which can be accessed at `/admin.html` in a production build. It uses [Decap CMS](https://decapcms.org/). It is configured to edit the content in the `clue-curriculum` repository. It is best to always pass the CMS a `unit` url parameter. Otherwise it will download pretty much all of the files in `clue-curriculum`. With a `unit` parameter it will only download the files for that unit.

## URL Parameters

- **`curriculumBranch`** By default the CMS edits the `author` branch. You can change the branch by passing a different branch name to this parameter. The CMS will not create this branch for you. You'll need to create it yourself.
- **`unit`** By default the CMS displays all of the units at the same time. It is better to work with a single unit at a time by using the `unit` param. It should be passed the unit code. This limits what is displayed in the CMS and it also configures the media library to show the images from that unit.
- **`iframeBase`** By default the CMS will use an iframe pointed at `./iframe.html` to edit the CLUE documents. You can use this param to replace `.` with something else. This is useful for local testing (see below)
- **`localCMSBackend`** By default the CMS works with the `github` backend. This means even when doing local CLUE development the CMS will update the `clue-curriculum` repository directly. If you add the `localCMSBackend` parameter the CMS will attempt to work with a local git proxy running at localhost:8081. You can start this proxy with:

  `cd ../clue-curriculum; npx netlify-cms-proxy-server`

## Authorization

The github backend used by the CMS requires a GitHub OAuth app and small service to handle getting a token from GitHub so the browser can talk directly to the GitHub API.

The OAuth app is: [Concord Consortium CMS](https://github.com/organizations/concord-consortium/settings/applications/2137890)

We are using a firebase function for the service. It is deployed to:
<https://console.firebase.google.com/project/cms-github-auth/overview>.

The code for this function is located here: <https://github.com/Herohtar/netlify-cms-oauth-firebase>.

It was configured with the client ID and client secret from the GitHub OAuth app.

## Architecture

The CMS has two parts in CLUE. One is the CMS itself. The other is the document editor that is embedded inside of iframes inside of the CMS.

### The CMS itself

This is the code from Decap configured by us to render two custom components. This configuration is in `init-cms.ts`. This is not the typical configuration of the CMS. If you look at the docs, the common pattern is to have a yaml configuration file located in the repository with files being edited. And then a static html page loads in decap js from a CDN. This decap js then finds the configuration and then lets you start editing the files in the repository.

This approach was not flexible enough for us, so instead we configure Decap using the code in `init-cms.ts`. This file includes an embedded configuration which is dynamically changed depending on the url parameters. It also registers 3 custom widgets. We are only using 2 of these components: `clue` and `preview-link`.

These files are built using a build system separate from the main CLUE build system. This was done so that dependencies of CLUE and the CMS would not be tied together. This is all located in the `/cms/` folder.

#### `preview-link`

Is a widget that displays a link so authors can easily open CLUE and see the section they are currently editing. It has to load the Unit json to figure out where in the unit this current section is located. This location is needed to construct the `problemOrdinal` which is what is needed when launching CLUE.

#### `clue`

This is an iframe-control. It isn't really specific to CLUE. The iframe src it shows is:
`./cms-editor.html?curriculumBranch=${curriculumBranch}`. Then it sends the content from the CMS to this iframe using postMessage. And it gets the updated content from the iframe by listening to "message" events. This approach was used because there were conflicts between the CLUE libraries and the CMS libraries. By putting CLUE in an iframe we avoid these problems.

### The document editor (cms-editor.html)

This is an additional entry point built by the main CLUE build system. It is very similar to the standalone document editor. The difference is that it listens for the "message" events sent by the iframe widget above, and sends content changes via postMessage to the iframe widget.

This document editor is located in `/src/cms/`

## Building and Deployment

### Local development

To work on the CMS locally you'll need to start both CLUE and the CMS:

- start CLUE by running `npm start` in the top level folder
- if running the local Git proxy, start it next so it gets port 8081
- in a new terminal, open the `/cms` folder
- make sure its dependencies are installed: `npm i`
- start the CMS by running `npm start`
- open the CMS with `http://localhost:[cms_port]/?iframeBase=http://localhost:[clue_port]&unit=[clue_unit_code]&curriculumBranch=[your own branch]`
    (add `&localCMSBackend` if using it). Make sure there are no extra "#" or "/" characters in the URL.

Typically CLUE will be running on port 8080 and the CMS will be running on 8082, or CLUE on 8080, Git proxy on 8081, and CMS on 8082. In this case the url above would be:

- No proxy: `http://localhost:8082/?iframeBase=http://localhost:8080&unit=[clue_unit_code]&curriculumBranch=[your own branch]`
- With proxy: `http://localhost:8082/?iframeBase=http://localhost:8080&localCMSBackend&unit=[clue_unit_code]`

With this approach you'll be editing the content in the `clue-curriculum` repository directly. By default this will use the `author` branch in the `clue-curriculum` repository. So you aren't making changes to the same branch as other people, you should make your own branch in that repository and pass it to the `curriculumBranch` parameter. You have to make this branch using your own git tools, the CMS cannot create branches itself.

If you want to have more local access to the curriculum you are editing, and you don't want to be updating the `clue-curriculum` repository, you can use the `localCMSBackend` parameter. See above for details on how to use this. Note the proxy needs to be on its own port. If it can't start on 8081 (because something else is running there) then you'll need to configure it. See the "Configure the Decap CMS proxy server port number" section of [this Decap documentation page](https://decapcms.org/docs/working-with-a-local-git-repository).

When the CMS loads the unit it will look for it at: `https://models-resources.concord.org/clue-curriculum/branch/[curriculumBranch]/msa/content.json`. This unit file is just used to figure out the tools that should be enabled in the document editors the CMS shows. Importantly, it is not loading it directly from Git. This means that your curriculumBranch needs to be pushed and deployed before the CMS will work. This is required even when working with a local git repository. Passing a full url for the unit does not work; it seems to cause other problems.

### Remote build

In the CI (github actions), the toplevel `npm run build` is used. This will build both CLUE and the CMS. And then it will copy the files from `/cms/dist` to `/dist/cms`. Additionally, it copies the file `/cms/dist/admin.html` to `/dist/admin.html`. This admin.html file refers to its resources in the cms folder like `cms/admin.js` and `cms/admin.css`. This file is called `admin.html` because that was its original name, and now various authors have direct links to it. So we don't want to change that name.

Currently the CMS build environment is not designed to be used with the release system that we use for the main part of CLUE. So authors cannot go to `https://collaborative-learning.concord.org/admin.html`. Instead most of these authors are using master for their authoring so they go to: `https://collaborative-learning.concord.org/branch/master/admin.html`. **We should fix this so we don't have to worry about breaking authoring when merging to master.**

## Notes on CMS page components

Sometimes the components on the CMS page are reused and sometimes they are reconstructed. This behavior has no effect on our current components, but it should be kept in mind if creating a custom component.

- After publishing a CMS page, the component on the page is not reconstructed instead it is reused. The existing component is reused.
- When leaving (using the CMS ui) and coming back to the same page the component is reconstructed.
- When leaving (using the CMS ui) with unsaved changes, a message is shown, and the control is reconstructed when returning to the page.
- When leaving with unsaved changes by reloading the page in the browser:
  - A message is shown before reload confirming you want to lose your changes
  - A message is shown when the page is loaded again about an unsaved draft Choosing the draft doesn't always work. See the "Known Issues" section of cms.md

## TODO

### Image tiles cause changes

We should look at what the image tile is changing in the export. Perhaps we can fix the export to be more consistent. My guess is it will have something to do with the size bouncing around on load. I think that will be hard to fix (appears to be fixed now: [PT-184824215](https://www.pivotaltracker.com/story/show/184824215))

### Try to hide the unit content.json files

They currently show up on the right side when traversing the CMS tree on the left. I think they could be hidden using some of the filter properties.

### CLUE section editor scrolling

The CLUE editor widget should expand its height like the CMS's rich text editor widget. This way the CLUE content won't have an extra scrollbar.

### Unit editing

It would be helpful if the unit configuration could be edited in the CMS. Perhaps just as raw JSON. However when we tackle supporting the addition of new sections, problems, and investigations we will need more than just raw JSON editing. We could switch to a folder based approach for defining the parts of the units, but that might not solve all of the problems. This needs some research to figure out the most efficient way to support this editing while using the CMS.

### Preview of a section on the right side of the CMS

This would allow the author to see the section in its read-only mode like what is seen in the CLUE curriculum tabs.

## Known Issues

### Backup Draft

The CMS has a feature for saving a draft of your work locally before you publish. If the page crashes or you reload the window without publishing, when you return the page the CMS will ask if you want to restore this draft. Unfortunately this doesn't work all of the time. If the entry you are looking at behind the dialog asking to restore the draft says it is "loading", then it typically won't work.

As far as we can tell what happens is when the entry is loaded two async functions are started. One is loading the backup draft, the other is downloading the real entry from GitHub (or whatever backend you've configured). If the backup draft function completes first, the dialog will block the real entry loading from continue. If you say yes to restore the backup draft, it will be restored, but then the real entry loading will complete. When the real entry loading completes it replaces the backup draft with the real entry essentially blowing away your backup draft.

If you are lucky and the real entry loads first, you will see this real entry behind the dialog asking about the backup draft. In this case if you choose to restore the backup draft it will stick.

[This issue](https://github.com/decaporg/decap-cms/issues/5055) describes basically the same problem.

The place to look in the Decap code is the Editor component: `packages/netlify-cms-core/src/components/Editor/Editor.js`.
In its `componentDidMount` function, you can see it call `retrieveLocalBackup` and then call `loadEntry`. Those are the 2 async functions. When the `retrieveLocalBackup` completes it will cause the Editors props to change which will trigger `componentDidUpdate`. In `componentDidUpdate` if the `localBackup` property is toggled on then the confirm dialog is shown. And if the user confirms then `loadLocalBackup` is called. This sets the `entryDraft.entry` to the backup contents. When `loadEntry` completes it also sets `entryDraft.entry` to the loaded entry.

A possible fix would be to delay the call to `retrieveLocalBackup` until `loadEntry` has either completed successfully or it was not successful at finding an entry. This way it would not be possible for `loadEntry` to come in later and replace the entry.

A useful way to confirm this behavior is to add console logs in ClueControl when the component is initialized and when when it is rendered and when it calls the CMS's onChange. It is also useful to look at the contents of the CMS's backup. That can be found in the browser Developer tools: `Application/IndexDB/localforage/keyvaluepairs`. In this database search for keys starting with `backup`.

### Nested collection uppercase paths

The Decap nested collection implementation will lower case the path after publishing an entry if a "customPath" is setup. This happens in this function `slugFromCustomPath`. A customPath is configured with a line like:
`meta: { path: { widget: "string", label: "Path", index_file: "content" } }` in the CMS config. That meta line makes the path to the entry visible to the user and allows them to change it. But the problem with this is that causes the slug to be lowercased which then in turn causes errors with the GitHub backend because the slug is used to figure the path to request. GitHub is case sensitive so a lowercased path will not be found.

I think the right fix is to change `slugFromCustomPath` to not create a lowercased slug. However if we are going to try to use the PR which adds support for flat folders it might take care of this problem.

The short term solution is to remove the `meta...` property from the config. This configure seems like it isn't needed. I suspect it was added so we could specify the `index_file`. However it seems to work without configuration. I'd guess it just loads which ever file it finds in the directory.

## Wishlist

### More flexible nested collection support

We are using the [nested collection beta feature](https://decapcms.org/docs/beta-features/#nested-collections) of Decap. It allows authors to edit a nested set of folders containing the content. However it requires that each folder only contains a single file and the file has the same name. CLUE uses `content.json` for this filename. It would be better if a folder could contain multiple files with different names. There has been work in Decap towards this:

- <https://github.com/decaporg/decap-cms/issues/4972>
- <https://github.com/decaporg/decap-cms/pull/6498>

### Mixed entry types in nested collections

Our units have investigations, problems, and sections. We have broken apart the sections into separate files. It would be nice if we broke apart the other levels as well. That way information from these levels could be used by the CMS at least for naming and possibly ordering.

### Ordering in nested collections

The levels of hierarchy of a unit have an order defined by their parent object. It would be useful if the tree shown by the nested collection could be ordered based on this. This seems tricky since the nested collection is based just on the folder structure, and if we started putting multiple files in a single folder, it wouldn't be obvious which file in a parent folder is the parent of the current entry.
