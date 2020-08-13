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

## Deploying database rules:

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