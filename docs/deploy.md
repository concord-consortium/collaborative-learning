# S3 Deployment

This project is configured to automatically deploy branches and tags to S3. These branches and tags are stored in unique folders in S3. Tags can be "released" to production by copying a special `index-top.html` file to the top level S3 folder.

Deploying to S3 is handled by the [S3 Deploy Action](https://github.com/concord-consortium/s3-deploy-action). Building the `index-top.html` is done by webpack when it receives a `DEPLOY_PATH` environment variable from the S3 Deploy Action.

Pushes are deployed to `models-resources/collaborative-learning/` by the `s3-deploy` job in [`ci.yml`](../.github/workflows/ci.yml). A released version is promoted to the top-level `index.html` (production) or `staging.html` (staging) by [`release.yml`](../.github/workflows/release.yml), which is started by [`release-production.yml`](../.github/workflows/release-production.yml) or [`release-staging.yml`](../.github/workflows/release-staging.yml) via `workflow_dispatch`.

## AWS Access

The GitHub actions in this project are allowed to update files in S3 using OIDC. An IAM role has been created in AWS with a trust policy that allows GitHub actions in this specific repository to assume this IAM role. The IAM role has a `RepoName` tag and a managed policy that uses this tag to give the role's users permission to update files in `models-resources/[RepoName]`.

See [deploy-setup.md in starter-projects](https://github.com/concord-consortium/starter-projects/blob/main/doc/deploy-setup.md) for how the AWS side is set up.

`release.yml` is a reusable workflow, so `release-production.yml` and `release-staging.yml` must each grant `id-token: write`. A called workflow can never have more token permissions than its caller, and GitHub does not grant `id-token: write` by default.

## Deploy timing

The Firebase functions, the Firestore and Realtime Database rules, and the Firestore indexes are
deployed separately from the CLUE client, and usually not at the same moment. So every PR that
changes one of them says in its description when each part can be deployed, and why, in a
callout like this:

```markdown
> [!IMPORTANT]
> **Deploy timing**
> - **functions: with** — the released client waits for a comment that the new empty-document
>   skip never posts, so Ideas on an empty document would look frozen until the client ships.
> - **rules: before** — only widens what chat messages may contain; the released client never
>   writes the new fields.
```

| Part | Files that count |
|---|---|
| functions | `functions-v1/`, `functions-v2/`, `authoring-api/`, any `shared/` file a function compiles, and `shared/package.json` and `shared/package-lock.json` |
| rules | `firestore.rules`, `database.rules.json` |
| indexes | `firestore.indexes.json` |

- **before**: safe to deploy as soon as it merges. The currently released client keeps working with it.
- **with**: deploy just before or just after the client release, but not long before it.
- **after**: needs the new client released first.

The reason is required: it is what a release manager reads when planning the deploys. Judge both
directions: the new client running against the currently deployed part, and the **currently
released client running against the new part**. The second is the easy one to miss — a change can
break nothing and still look broken, like the frozen Ideas button above. Parts can differ: the rules
can go out early so the PR is easier to test while the functions wait for the release. Put anything
more specific — ordering, secrets, index build time — elsewhere in the description.

The callout must be a GitHub alert (`[!IMPORTANT]` is the usual choice; `[!WARNING]` suits an
`after`) whose first line is `**Deploy timing**`, so it stands out to reviewers. Entries anywhere
else in the description are not read, and neither is a callout inside an HTML comment or a code
block. Give one callout; a second one fails the check. Tests and docs in these folders don't need an entry.

The [`Deploy Timing`](../.github/workflows/deploy-timing.yml) check fails until each part the PR
touches has exactly one entry with a reason and no entry in the callout is unreadable (an unknown
part or timing, or a bold list item it can't parse). It re-runs when the description is edited; a
manual re-run of an old run uses the description as it was then, so edit the description or push
instead. To run it
locally: `npx --prefix scripts tsx scripts/check-deploy-timing.ts --base origin/master --body-file <description.md>`.

When preparing a release, `scripts/release-deploy-report.ts` reads the callouts of every PR in the
release and reports, per part, the strictest timing given (a part can deploy no earlier than that)
and the PRs without a usable entry (none, more than one, one with no reason, or an unreadable
entry in the callout), grouped by author. It flags a part whose PRs give different timings, since
the strictest one hides the others' reasons. See the script's header for how to run it.

## Curriculum timing

Some client changes need curriculum units to change too, for example a unit that sets its own
toolbar list and so doesn't get a newly added default button. The curriculum lives in its own
repository, and authors preview their curriculum branches against CLUE's `master` branch, so the
order of the two changes matters before the client is even released.

Which units are affected can change after the PR is written: a unit can gain the setting that makes
it depend on the change, and a branch can be created or updated. So a PR with such a dependency
describes the affected units by a **condition**, not by name, and says when they must change and
why:

```markdown
> [!IMPORTANT]
> **Curriculum timing**
> - **before**: any unit, on any branch, whose config sets `settings.dataflow.tools` at the unit,
>   investigation or problem level without including `connect`.
>   - Why: such a unit has no way to connect a device once this is on master. The released client
>     skips tool names it doesn't know, so adding `connect` is safe to do now.
>   - As of 2026-10-19: `curriculum/vibe/content.json` on `main` and on 12 other branches
>     (`NewCMPAuthor`, `aplus`, `authoring-testing`, …).
>   - Curriculum PR: <link>
```

Each entry has:

- **A timing**, one of the four below.
- **The condition** that decides whether a unit is affected. It is what stays true, so write it so
  someone else can search for it: the setting, the level it can be set at, and what makes a value
  need changing.
- **Why**, judged in both directions as with Deploy timing: the new client running against the
  current curriculum, and the currently released client running against the new curriculum.
- **A dated snapshot** of the units that matched when the PR was written, across every branch of
  the curriculum repository, not only `main`. It shows the size of the job and where to start, but
  the condition is the contract.
- **The curriculum PR**, when there is one.

The timings:

- **before**: the new client breaks the current curriculum. Change the matching units on the
  curriculum's `main` before the PR merges to CLUE `master`. Then have the authors of every other
  branch that still matches merge `main` or make the change on their branch.
- **with**: each breaks the other: the new client fails with the current curriculum, and the
  released client fails with the new one. The two have to switch over together at the release.
  That is rare and usually means the change should accept both forms for a while.
- **after**: the currently released client breaks with the new curriculum. Change the matching
  units on `main` after the client is released; branches can pick the change up once the PR is on
  `master`.
- **any time**: neither breaks; the curriculum change is an improvement, such as a unit opting in
  to a new option.

Whoever makes the curriculum change runs the search again when they do it, for `before` just
before the CLUE PR merges, rather than working from the snapshot. A search that walks every remote
branch with `git grep <ref>` and `git show <ref>:<path>` after a `git fetch --prune` is enough; it
doesn't need a local checkout of each branch.

The callout can't cover a unit that starts to match after the PR merges. When the condition is a
lasting rule rather than a one-time migration, also add it to the authoring docs, usually
[unit-configuration.md](unit-configuration.md), so authors who set the option later know it. For
example, the DataFlow `tools` entry there says that a unit with its own list must include
`connect`.

Use a separate callout from Deploy timing, with `**Curriculum timing**` as its first line; the
Deploy timing check reads only callouts headed `**Deploy timing**`. No check enforces this one.
Nothing in a diff shows that a curriculum unit depends on the change, so it is up to the PR's
author to notice. `scripts/release-deploy-report.ts` doesn't read it either.

## Where to find builds

- **branch builds**: when a developer pushes a branch, GitHub actions will build and deploy it to `https://collaborative-learning.concord.org/branch/[branch-name]/`. An issue-tracker prefix or suffix is stripped off and not included in the folder name, so the deployed name is often not the branch's git name. `concord-consortium/s3-deploy-action` (`src/deploy-props.ts`) strips the first of these that matches:
  | pattern | example branch | deployed to |
  |---|---|---|
  | `^[A-Za-z]{2,}-[0-9]+-(.+)$` | `CLUE-123-my-feature` | `branch/my-feature/` |
  | `^#?[0-9]{8,}-(.+)$` | `187654321-my-feature` | `branch/my-feature/` |
  | `^(.+)-#?[0-9]{8,}$` | `my-feature-187654321` | `branch/my-feature/` |

  The first pattern is the one that applies to the Jira branch names we use now. This matters wherever a branch URL is written down rather than followed from a link — the `clue` OAuth client's redirect URIs, for instance, must list the *deployed* path or portal login fails.
- **version builds**: when a developer pushes a tag, GitHub actions will build and deploy it to `https://collaborative-learning.concord.org/version/[tag-name]/`
- **released version path**: the released version of the application is available at `https://collaborative-learning.concord.org`
- **master branch**: the master branch build is available at both `https://collaborative-learning.concord.org/index-master.html` and `https://collaborative-learning.concord.org/branch/master/`.  The `index-master.html` form is preferred because it verifies the top level deployment is working for the current code. Additional branches can be added to the top level by updating the `topBranches` configuration in `ci.yml`
- **staging**: when staging a version for release it should be made available at `https://collaborative-learning.concord.org/index-staging.html`

## index-top.html

The key feature of `index-top.html` is that it references the javascript and css assets using relative paths to the version or branch folder. So the javascript url will be something like `version/v1.2.3/index.js`. This way when the `index-top.html` is copied to the top level, the browser can find these assets.

Building a functional index.js that works when it is loaded either by `index.html` or `index-top.html` depends on using Webpack a certain way.  Since Webpack 5, the `publicPath` configuration option's default value is `'auto'`. With this value the public path is computed at runtime based on the path the script was loaded from. So if the script was loaded from `https://collaborative-learning.concord.org/version/v1.2.3/index.[hash].js` then at runtime the public path will be set to `https://collaborative-learning.concord.org/version/v1.2.3/`. The reason the public path matters has to do with how javascript loads and references assets like images or json files.

For example if `components/app.tsx` uses:
```
import Icon from "../assets/concord.png";
...
<img src={Icon}/>
```
This `<img>` tag will be added by React to the dom. When the browser loads the image, the value of `src` will be relative to the `index.html` file. This would be a problem without the computed public path. Webpack handles this by automatically pre-pending the computed public path onto the URL it uses for `Icon`. So whether the html file is located at `https://collaborative-learning.concord.org/index.html` or `https://collaborative-learning.concord.org/version/v1.2.3/index.html`, the value of `Icon` is based on the location of the javascript file. So in this case the value of `Icon` will be `https://collaborative-learning.concord.org/version/v1.2.3/[asset name computed by webpack].png`.

If the import statement is not used and instead the src of the image was hard coded like:
```
<img src="assets/concord.png"/>
```
Webpack has no control of this, so at runtime this will be loaded relative to the html file.  So when the `index.html` is at the top level, the browser will look for `https://collaborative-learning.concord.org/assets/concord.png` and not find it. So hard coded paths like this should be converted to using import statements.

In some cases we dynamically compute a path from which to load an asset. In most of these places webpack imports can still be used. Webpack supports this by static analysis of the import function, so we just need to change those places in the code slightly. Here is the documentation about this:
https://webpack.js.org/api/module-methods/#dynamic-expressions-in-import

If using import is too difficult you can work around this by using the special `__webpack_public_path__` variable. In CLUE there is a `getAssetUrl` function to make this easy. Like this:

```
<img src={getAssetUrl("assets/concord.png")}/>
```
A possible reason for doing this is if you are working with an external library that you don't have control over and need to pass it a path to load an asset.

When possible, switching to an import is preferred because it means that webpack knows about all of the referenced assets. This means we can use webpack to build a manifest which is useful for offline support.

Note: there is a `publicPath` configuration option for the `HtmlWebpackPlugin`. This is a different but related option, it controls the prefix the plugin adds before assets (javascript and css) referenced in the generated html file. This option is used so the `index-top.html` references assets in the version folder and `index.html` references assets in the same folder.

## Local testing for compatibility with index-top.html

When running in the regular dev server, you won't see errors when using hard coded paths.

Typically, hard coded paths will only work if you are using `CopyWebpackPlugin`. This is because these assets need to be copied into the `dist` folder. With import statements the assets are copied for you. If you remove the `CopyWebpackPlugin` you will likely see errors when using the dev server, so you can find the places that need to be fixed.

If you need to continue referencing files without using import, you can find these issues and test fixes for them locally using the following npm scripts:
- **`top-test:build`** builds the project into the `top-test/specific/release` folder and copies `top-test/specific/release/index-top.html` to `top-test/index.html`.
- **`top-test:serve`** starts a web server which is serving the `top-test` folder.

After running the the above two scripts you can try loading http://localhost:[port]/ and see if all of the assets load correctly.

## Benefits compared to previous branch based releases

Previously we would do releases by updating a branch named `production`. This would build and deploy the application to the top level of the s3 folder.

With this new approach a release is done by copying a single small html file from a version folder up to the top level. This means the javascript and css is not rebuilt just to promote a version. Therefore the exact build products can be tested before it is released.

Because deploying a version or branch only updates files within a folder specific to that version or branch, the utility used to copy files up to S3 can be more simple and efficient. In the previous model when the utility was uploading a production branch it would need to make sure to ignore the branch and version folders. Otherwise it might delete these folders because they aren't part of the upload. Even if the utility was configured to never delete files, it still needed to load the meta data of all of the files in the branch and version folders. It did this to know what has changed between local and remote. And S3's APIs don't support filtering listings of files other than a folder prefix.
