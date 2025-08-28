# Collaborative Learning

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/concord-consortium/collaborative-learning)

Collaborative Learning was built by [The Concord Consortium](http://concord.org/) for the
MSU Inscriptions project.

## Development

### Initial steps

1. Clone this repo and `cd` into it
2. Run `npm install` to pull dependencies
3. `cd` into the `cms` subdirectory and run `npm install` to pull authoring dependencies (This is currently required even if you will not need to author content.)
4. `cd` back to the repo's root directory, then run `npm start` to run `webpack-dev-server` in development mode with hot module replacement

### Building

If you want to build a local version run `npm build`, it will create the files in the `dist` folder.
You *do not* need to build to deploy the code, that is automatic.  See more info in the Deployment section below.

### Notes

1. Make sure if you are using Visual Studio Code that you use the workspace version of TypeScript.
   To ensure that you are open a TypeScript file in VSC and then click on the version number next to
   `TypeScript React` in the status bar and select 'Use Workspace Version' in the popup menu.

## Deployment

Deployments are based on the contents of the /dist folder and are built automatically by GitHub Actions for each branch and tag pushed to GitHub.

Branches are deployed to `https://collaborative-learning.concord.org/branch/<name>/`.

Tags are deployed to `https://collaborative-learning.concord.org/version/<name>/`

You can view the status of all the branch and tag deploys [here](https://github.com/concord-consortium/collaborative-learning/actions).

The production release is available at `https://collaborative-learning.concord.org`.

Production releases are done using a manual GitHub Actions workflow. You specify which tag you want to release to production and the workflow copies that tag's `index-top.html` to `https://collaborative-learning.concord.org/index.html`.

See [CLUE-release-steps.md](https://github.com/concord-consortium/dev-templates/blob/main/CLUE-release-steps.md) for the steps for a production release.

## Developing/deploying cloud functions

CLUE uses several Google cloud functions to implement certain features that would be difficult (or impossible) to implement entirely client-side. There are two folders of functions `functions-v1` and `functions-v2`. We are trying to incrementally migrate the v1 functions into the v2 folder.

Each folder has its own readme:

- [functions-v2](functions-v2/README.md)
- [functions-v1](functions-v1/README.md)

## Testing/Deploying database rules

### Requirements

- The tests currently only run with Node.js version 16.x
- You need the firebase CLI. Version 12 is compatible with Node 16: `npm install -g firebase-tools@12`
- You should be logged in to firebase: `firebase login`

Java is also required for running the emulators. There are various ways to install it; I did this:

```shell
brew install java
echo 'export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"' >> ~/.zshrc
```

Firestore security rules are unit tested and realtime database rules could be with some additional work.

### To test database rules

The emulator must be running when the test is invoked.

```shell
cd firebase-test
npm run start &
npm run test
```

### To deploy database rules

You deploy firebase functions and rules directly from the working directory using
the `firebase deploy` command. You can see `firebase deploy help` for more info.

See which project you have access to and which you are currently using via: `firebase projects:list`

```shell
npm run deploy:firestore:rules    # deploys firestore rules
npm run deploy:firebase:rules     # deploys firebase (realtime database) rules
```

## Debugging

To enable per component debugging set the "debug" localstorage key with one or more of the following:

- `bookmarks` this will show a tiny text status above the bookmark indicating which users have bookmarked this document. It will also print information about the document bookmarks each time a bookmark is toggled.
- `canvas` this will show the document key over the canvas, useful for looking up documents in Firebase
- `iframe` this will print info to the console as document changes are sent from the iframe'd CLUE to the parent frame. This iframe'd CLUE is used by the CMS.
- `docList` - this will print a table of information about a list of documents
- `document` this will add the active document as `window.currentDocument`, you can use MST's hidden toJSON() like `currentDocument.toJSON()` to views its content.
- `drop` console log the dataTransfer object from drop events on the document.
- `firestore` turn on Firestore's internal debugging, this logs all queries to Firestore.
- `history` this will: print some info to the console as the history system records changes, print the full history as JSON each time it is loaded from Firestore, and provide a `window.historyDocument` so you can inspect the document while navigating the history.
- `images` this will set `window.imageMap` so you can look at the status and URLs of images that have been loaded.
- `listeners` console log the adding, removing, and firing of firebase listeners
- `loading` console log timing information for various phases of the startup process
- `logger` console log all messages sent to the logging service
- `sharedModels` console log messages about shared models, currently this is only used in the variables shared model
- `stores` this will set `window.stores` so you can monitor the stores global from the browser console.
- `undo` this will print information about each action that is added to the undo stack.

## Testing

CLUE has a fairly extensive set of jest (unit/integration) tests and cypress (integration/end-to-end) tests. To run them:

```bash
npm [run] test                # run all jest tests
npm [run] test -- abc.test.ts # run a single jest test
npm run test:coverage         # run all jest tests and report coverage
npm run test:cypress          # run the cypress tests headless
npm run test:cypress:open     # open the cypress app for running the cypress tests interactively
```

### Test Credentials Setup

The tests require portal credentials for authentication. These can be set up in two ways:

#### Local Development
Create a `cypress.env.json` file in the project root (this file is gitignored):
```json
{
  "auth": {
    "username": "your-username",
    "password": "your-password"
  }
}
```

#### CI/GitHub Actions
For automated testing in CI, the credentials are set as GitHub Secrets:
- `PORTAL_USERNAME`: The portal username for test authentication
- `PORTAL_PASSWORD`: The portal password for test authentication
- `PORTAL_TEACHER_USERNAME`: The portal username for teacher test authentication
- `PORTAL_TEACHER_PASSWORD`: The portal password for teacher test authentication

The user names and passwords are stored in the 1Password shared `Developer` vault.

These secrets are automatically used by the CI workflow for running tests.

The tests are run automatically on PRs and Codecov is configured to track coverage. Codecov will report on whether a given PR increases or decreases overall coverage to encourage good testing habits.

Note that currently, some of the jest tests (notably `db.test.ts`) and many of the cypress tests target the the production database, albeit generally `qa` or `test`-specific portions of the production database. It would be better if these tests targeted the emulators. Furthermore, some of the cypress tests require launching from the portal via activities which target the `master` branch, which means that the automated cypress tests that run on a PR can fail due to code on the master branch. This should be fixed with some combination of targeting the emulators and mocking the necessary portal interactions.

### URL parameters

There are a number of URL parameters that can aid in testing:

|Parameter       |Value(s)                 |Description|
|----------------|-------------------------|-----------|
|`appMode`       |`dev`, `qa`, `test`      |Unsecured modes that are partitioned off from authenticated sections of the database.|
|`unit`          |`sas`, `msa`, etc.       |Abbreviated code or URL for the curriculum unit.|
|`problem`       |`2.1`, `3.2`, etc.       |Reference to individual problem in curriculum unit.|
|`demo`          |none                     |Launches demo creator UI|
|`demoName`      |string (default: `CLUE`) |Used to partition the demo portion of the database.|
|`network`       |string                   |Specify the network with which a teacher user is affiliated.|
|`fakeClass`     |string                   |Class id for demo, qa, or test modes.|
|`fakeUser`      |`(student\|teacher):<id>`|Configure user type and (optionally) id.|
|`qaGroup`       |string                   |Group id for qa, e.g. automated tests.|
|`firebase`      |`emulator\|<URL>`        |Target emulator for firebase realtime database calls.|
|`firestore`     |`emulator\|<URL>`        |Target emulator for firestore database calls.|
|`functions`     |`emulator\|<URL>`        |Target emulator-hosted firebase functions.|
|`noPersistentUI`|none                     |Do not initialize persistent ui store.|
|`researcher`    |`true`                   |When set to true the user authenticates as a researcher|
|`studentDocument`|string                  |If set to the ID of a document, this will be displayed as the left-side content.|
|`studentDocumentHistoryId`|string         |Open the history slider and move to the specified revision in the `studentDocument`.|
|`portalDomain`  |string                   |Used for dev/qa of standalone auth, this overrides which portal is used for auth|
|`firebaseEnv`   |`production`,`staging`   |Target Firebase project for data and functions|
|`showAiSummary` |`true`                   |When set to true the "ai summary" button in the document editor|
|`includeModelInAiSummary`|`true`          |When set to true the JSON.stringified raw model is included in the AI summary|

The `unit` parameter can be in 3 forms:

- a valid URL starting with `https:` or `http:` will be treated as an absolute URL.
- a string starting with `./` will be treated as a URL relative to the javascript files of CLUE.
- Everything else is treated as a unit code, these codes are first looked up in a map to remap legacy codes. Then the URL of the unit is created by `${curriculumSiteUrl}/branch/${branchName}/${unitCode}/content.json`.
  - `curriculumSiteUrl` defaults to `https://models-resources.concord.org/clue-curriculum`.
  - `branchName` defaults to `main`.
  - To find out more about customizing these values look at `app-config-model.ts`.

The `firebase`, `firestore`, and `functions` params can take an `emulator` value which will make CLUE use the default host and port for the emulator of that service. Alternatively you can pass a URL like `http://localhost:1234` for the emulated service.

### Standalone Document Editor

There is an alternative entry point for CLUE available at `/editor/`. This can be used to save and open individual documents from the local file system. Remote documents can be loaded into this editor with the `document` URL parameter. The editor requires a `unit` parameter to configure the toolbar. It can load an exported document content which is typical for section documents. It can also load a raw document content which is the same format that is stored in Firebase. It will save in the same format that was loaded.

The `noStorage` parameter can override the default behavior. By default the editor will save the current document to the browser's session storage. When editor is reloaded this same document will be loaded in. If you make a new tab and visit the editor this document won't be there anymore because it is in session storage. There is a "reset doc" button which clears the storage and reloads the page. The `noStorage` parameter will prevent it from loading or saving to session storage.

The `document` parameter is useful if you want to work on something that requires a document in a specific state. You can just reload the page and get back to this state. You can use this locally by creating an initial document in `/editor/`, and save the file to `src/public/[filename]`. Now you can load the document back with the parameter `document=[filename]`. This works because the document parameter will load URLs relative to the current page in the browser. This approach can also be used in Cypress tests. It would mean the test could just load in a document to test instead of having to setup the document first.

The `readOnly` parameter will open the document in readOnly mode. This is useful for testing or debugging issues with tiles that have different displays when in readOnly model.

The `unwrapped` parameter will open the document without any surrounding UI. This is useful for taking screenshots of documents.

### QA

Along with `dev`, `test`, `authed` and `demo` modes the app has a `qa` mode.  QA mode uses the same parameters as demo mode with one additional parameter:

qaGroup - the group to automatically assign the fake user to after connecting to the database.

Additionally in `qa` mode the "root" in Firestore and the Realtime database is based on the Firebase user uid. This user is stored in session storage so each new tab will start a new root. In Cypress session storage is cleared between tests so each new test will have its own root.

### To run Cypress integration tests

- `npm run test:local`
- `npm run test:dev`
- `npm run test:branch` (requires change in environments.json to add the branch name)
- `npm run test:master`
- `npm run test:production`

### Additional notes about configuration

You can also temporarily overwrite any configuration option using env variables with `CYPRESS_` prefix. E.g.:

`CYPRESS_baseUrl=https://collaborative-learning.concord.org/branch/fix-data-attributes npm run test:dev`

### Writing tests, workflow and patterns

1. Tests should not depend on other tests.
2. Take a look at `cypress/support/commands.js`. This file implements LARA-specific helpers that will make test
implementation simpler. Existing commands at the moment:

    - setupGroup
    - upLoadFile

## License

Collaborative Learning is Copyright 2018 (c) by the Concord Consortium and is distributed under the [MIT license](http://www.opensource.org/licenses/MIT).

See license.md for the complete license text.
