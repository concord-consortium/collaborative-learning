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
2. Create new entry in CHANGELOG.md
3. Run `git log --pretty=oneline --reverse <last release tag>...HEAD | grep '#' | grep -v Merge` and add contents (after edits if needed to CHANGELOG.md)
4. Run `npm run build`
5. Copy asset size markdown table from previous release and change sizes to match new sizes in `dist`
6. Create `release-<version>` branch and commit changes, push to GitHub, create PR and merge
7. Checkout master and pull
8. Checkout production
9. Run `git merge master --no-ff`
10. Push production to GitHub
11. Use https://github.com/concord-consortium/collaborative-learning/releases to create a new release tag

### Testing

Run `npm test` to run all tests.

### QA

Along with `dev`, `test`, `authed` and `demo` modes the app has a `qa` mode.  QA mode uses the same parameters as demo mode with two additional parameters:

1. qaGroup - the group to automatically assign the fake user to after connecting to the database.
2. qaClear - either "all", "class" or "offering".  When this parameter is present the QA database is cleared at the level requested based on the user parameters.
   This is useful to clear data between automated QA runs.  When complete the app will display `<span className="qa-clear">QA Cleared: OK</span>`.

## License

Collaborative Learning is Copyright 2018 (c) by the Concord Consortium and is distributed under the [MIT license](http://www.opensource.org/licenses/MIT).

See license.md for the complete license text.