# Collaborative Learning

Collaborative Learning was built by [The Concord Consortium](http://concord.org/) for the
MSU Inscriptions project.

## Development

### Initial steps

1. Clone this repo and `cd` into it
2. Run `npm install` to pull dependencies
3. Run `npm start` to run `webpack-dev-server` in development mode with hot module replacement

### Building

If you want to build a local version run `npm build`, it will create the files in the `dist` folder.
You *do not* need to build to deploy the code, that is automatic.  See more info in the Deployment section below.

### Notes

1. Make sure if you are using Visual Studio Code that you use the workspace version of TypeScript.
   To ensure that you are open a TypeScript file in VSC and then click on the version number next to
   `TypeScript React` in the status bar and select 'Use Workspace Version' in the popup menu.

## Deployment

Production releases to S3 are based on the contents of the /dist folder and are built automatically by GitHub Actions
for each branch pushed to GitHub and each merge into production.

Merges into production are deployed to http://collaborative-learning.concord.org.

Other branches are deployed to http://collaborative-learning.concord.org/branch/<name>/.

You can view the status of all the branch deploys [here](https://github.com/concord-consortium/collaborative-learning/actions).

To deploy a production release:

1. Update the version number in `package.json` and `package-lock.json`
    - `npm version --no-git-tag-version [patch|minor|major]`
1. Update the `CHANGELOG.md` with a description of the new version
1. Verify that everything builds correctly
    - `npm run lint && npm run build && npm run test`
1. Copy asset size markdown table from previous release and change sizes to match new sizes in `dist`
1. Create `release-<version>` branch and commit changes, push to GitHub, create PR and merge
1. Checkout master and pull
1. Checkout production
1. Run `git merge master --no-ff`
1. Push production to GitHub
1. Use https://github.com/concord-consortium/collaborative-learning/releases to create a new release tag

## Developing/deploying cloud functions

CLUE uses a google cloud function to retrieve certain images from the firebase realtime database that
would otherwise not be allowed by security rules, notably to allow users in other classes to retrieve
images that were stored as part of a cross-class teacher support. Down the road we may encounter uses
for additional cloud functions.

The code for the functions is in the `functions` directory. You should be able to cd into the
`functions` directory and perform basic development operations:
```
$ cd functions
$ npm install     # install local dependencies
$ npm run lint    # lint the functions code
$ npm run test    # runs jest (unit) tests for the functions code
$ npm run build   # build the functions code (transpile TypeScript)
```
Note that there seems to be an uneasy relationship between the `node_modules` folder in the
`functions` directory and the one in the parent directory. I had to explicitly specify the
path to typescript in the `build` function. There's probably a better configuration available,
but in the meantime this seems to mostly work.

### Testing cloud functions

Google recommends (requires?) that [firebase-tools](https://www.npmjs.com/package/firebase-tools) be installed globally:
```
$ npm install -g firebase-tools
```
#### Running tests locally (without running functions in the emulator)
```
$ npm run serve                 # build and then start the emulators
$ npm run test                  # run all tests in `functions` directory
$ npm run test -- some.test.ts  # run a particular test
```
The existing tests currently work this way. They test the basic functionality of the cloud functions by importing and calling them directly from node.js test code. This is a simple and efficient way of testing the basic functionality without all the overhead of the functions emulator. The downside is that the node.js test environment is not the same as the hosted function environment. For instance, it's possible to return objects in node.js that can't be JSON-stringified which will throw an error when the function is hosted. That said, you can't beat the convenience of simply calling the functions directly.

#### Running local tests against functions hosted in the emulator
To run jest tests against functions running in the emulator requires [serving functions using a Cloud Functions Shell](https://firebase.google.com/docs/functions/local-shell#serve_functions_using_a_cloud_functions_shell). Currently, all of our functions are `HTTPS Callable` functions, which [can be called](https://firebase.google.com/docs/functions/local-shell#invoke_https_callable_functions) in this shell mode, but:
>Emulation of context.auth is currently unavailable.

#### Running CLUE against functions running locally in the emulator:
```
$ npm run serve   # build and then start the functions emulator
```
and launch CLUE with url parameter `functions=emulator`.

### To deploy firebase functions to production:
```
$ npm run deploy                        # deploy all functions
$ npm run deploy:getImageData           # deploy individual function
$ npm run deploy:postDocumentComment    # deploy individual function
```

By convention, our firebase functions have an internal version number that is returned with any results. This should be incremented appropriately when new versions are deployed. This will allow us to determine whether the current code in GitHub has been deployed or not, for instance. Also by convention, our firebase functions accept parameters of `{ warmUp: true }` which can be issued in advance of any actual call to mitigate the google cloud function cold-start issue.

### Serving CLUE from https://localhost
To test the deployed function(s) from your local development environment, you may need to run your local dev server with https to avoid CORS errors. To do so, [create a certificate](https://www.matthewhoelter.com/2019/10/21/how-to-setup-https-on-your-local-development-environment-localhost-in-minutes.html) in your `~/.localhost-ssl` directory and name the files `localhost.pem` and `localhost.key`. To use the certificate:
```
$ npm run start:secure
```

## Testing/Deploying database rules

### Requirements:

 * You should install the firebase CLI via: `npm install -g firebase-tools`
 * You should be logged in to firebase: `firebase login`

Firestore security rules are unit tested and realtime database rules could be with some additional work.

### To test database rules
```
$ cd firebase-test
$ npm run test
```

You deploy firebase functions and rules directly from the working directory using
the `firebase deploy` command. You can see `firebase deploy help` for more info.

See which project you have access to and which you are currently using via: `firebase projects:list`

### To deploy database rules:
```
$ npm run deploy:firestore:rules    # deploys firestore rules
$ npm run deploy:firebase:rules     # deploys firebase (realtime database) rules
```

## Debugging

To enable per component debugging set the "debug" localstorage key with one or more of the following:

- `canvas` this will show the document key over the canvas, useful for looking up documents in Firebase

## Testing

CLUE has a fairly extensive set of jest (unit/integration) tests and cypress (integration/end-to-end) tests. To run them:
```
$ npm [run] test                # run all jest tests
$ npm [run] test -- abc.test.ts # run a single jest test
$ npm run test:coverage         # run all jest tests and report coverage
$ npm run test:cypress          # run the cypress tests headless
$ npm run test:cypress:open     # open the cypress app for running the cypress tests interactively
```

The tests are run automatically on PRs and Codecov is configured to track coverage. Codecov will report on whether a given PR increases or decreases overall coverage to encourage good testing habits.

Note that currently, some of the jest tests (notably `db.test.ts`) and many of the cypress tests target the the production database, albeit generally `qa` or `test`-specific portions of the production database. It would be better if these tests targeted the emulators. Furthermore, some of the cypress tests require launching from the portal via activities which target the `master` branch, which means that the automated cypress tests that run on a PR can fail due to code on the master branch. This should be fixed with some combination of targeting the emulators and mocking the necessary portal interactions.

### URL parameters

There are a number of URL parameters that can aid in testing:

|Parameter  |Value(s)                  |Description|
|-----------|--------------------------|-----------|
|`appMode`  |`dev`, `qa`, `test`       |Unsecured modes that are partitioned off from authenticated sections of the database.|
|`unit`     |`sas`, `msa`, etc.        |Abbreviated code for selecting a curriculum unit.|
|`problem`  |`2.1`, `3.2`, etc.        |Reference to individual problem in curriculum unit.|
|`demo`     |none                      |Launches demo creator UI|
|`demoName` |string (default: `CLUE`)  |Used to partition the demo portion of the database.|
|`network`  |string                    |Specify the network with which a teacher user is affiliated.|
|`fakeClass`|string                    |Class id for demo, qa, or test modes.|
|`fakeUser` |`(student|teacher):<id>`  |Configure user type and (optionally) id.|
|`qaGroup`  |string                    |Group id for qa, e.g. automated tests.|
|`qaClear`  |`all`, `class`, `offering`|Extent of database clearing for automated tests.|
|`firebase` |`emulator` (for default) or `host:port`|Target emulator for firebase realtime database calls.|
|`firestore`|`emulator` (for default) or `host:port`|Target emulator for firestore database calls.|
|`functions`|`emulator` (for default) or `host:port`|Target emulator-hosted firebase functions.|

### QA

Along with `dev`, `test`, `authed` and `demo` modes the app has a `qa` mode.  QA mode uses the same parameters as demo mode with two additional parameters:

1. qaGroup - the group to automatically assign the fake user to after connecting to the database.
2. qaClear - either "all", "class" or "offering".  When this parameter is present the QA database is cleared at the level requested based on the user parameters.
   This is useful to clear data between automated QA runs.  When complete the app will display `<span className="qa-clear">QA Cleared: OK</span>`.

### To run Cypress integration tests:
- `npm run test:local`
- `npm run test:dev`
- `npm run test:branch` (requires change in environments.json to add the branch name)
- `npm run test:master`
- `npm run test:production`

### Additional notes about configuration

You can also temporarily overwrite any configuration option using env variables with `CYPRESS_` prefix. E.g.:
- `CYPRESS_baseUrl=https://collaborative-learning.concord.org/branch/fix-data-attributes npm run test:dev`

### Writing tests, workflow and patterns

1. Tests should not depend on other tests.
2. Take a look at `cypress/support/commands.js`. This file implements LARA-specific helpers that will make test
implementation simpler. Existing commands at the moment:

    - setupGroup
    - upLoadFile
    - clearQAData

## License

Collaborative Learning is Copyright 2018 (c) by the Concord Consortium and is distributed under the [MIT license](http://www.opensource.org/licenses/MIT).

See license.md for the complete license text.
