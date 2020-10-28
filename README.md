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

Production releases to S3 are based on the contents of the /dist folder and are built automatically by Travis
for each branch pushed to GitHub and each merge into production.

Merges into production are deployed to http://collaborative-learning.concord.org.

Other branches are deployed to http://collaborative-learning.concord.org/branch/<name>.

You can view the status of all the branch deploys [here](https://travis-ci.org/concord-consortium/collaborative-learning/branches).

To deploy a production release:

1. Increment version number in package.json
1. Run `npm install` to make sure dependencies are up to date and commit version to `package-lock.json`.
1. Create new entry in CHANGELOG.md
1. Run `git log --pretty=oneline --reverse <last release tag>...HEAD | grep '#' | grep -v Merge` and add contents (after edits if needed to CHANGELOG.md)
1. Run `npm run build`
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
$ npm run build   # build the functions code (transpile TypeScript)
```
Note that there seems to be an uneasy relationship between the `node_modules` folder in the
`functions` directory and the one in the parent directory. I had to back down to ESLint 6.x in
the `functions` directory to avoid ESLint plugin confusion and I also had to explicitly specify
the path to typescript in the `build` function. There's probably a better configuration available,
but in the meantime this seems to mostly work.

Google recommends (requires?) that [firebase-tools](https://www.npmjs.com/package/firebase-tools) be installed globally:
```
$ npm install -g firebase-tools
```

To run the functions locally in the emulator:
```
$ npm run serve   # build and then start the functions emulator
```
and uncomment the line in the code that configures CLUE to use the emulated functions:
```
firebase.functions().useFunctionsEmulator("http://localhost:5001");
```

To deploy the function(s) to production:
```
$ npm run deploy
```

To test the deployed function(s) from your local development environment, you will need to run
your local dev server with https to avoid CORS errors. To do so,
[create a certificate](https://www.matthewhoelter.com/2019/10/21/how-to-setup-https-on-your-local-development-environment-localhost-in-minutes.html)
and [configure Webpack to use it](https://webpack.js.org/configuration/dev-server/#devserverhttps). These changes are specific to your installation, so be careful not to commit them to the GitHub repository.

## Deploying database rules

### Requirements:

 * You should install the firebase CLI via: `npm install -g firebase-tools`
 * You shouuld be logged in to firebase: `firebase login`

You deploy firebase functions and rules directly from the working directory using
the `firebase deploy` command. You can see `firebase deploy help` for more info.

See which project you have access to and which you are currently using via: `firebase projects:list`

### To deploy database rules:
```
$ npm run deploy:firestore:rules    # deploys firestore rules
$ npm run deploy:firebase:rules     # deploys firebase (real-time-database) rules
```

## Debugging

To enable per component debugging set the "debug" localstorage key with one or more of the following:

- `canvas` this will show the document key over the canvas, useful for looking up documents in Firebase

## Testing

Run `npm test` to run all Jest tests.

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