# S3 Deployment

This project is configured to automatically deploy branches and tags to S3. These branches and tags are stored in unique folders in S3. Tags can be "released" to production by copying a special `index-top.html` file to the top level S3 folder.

Deploying to S3 is handled by the [S3 Deploy Action](https://github.com/concord-consortium/s3-deploy-action). Building the `index-top.html` is done by webpack when it receives a `DEPLOY_PATH` environment variable from the S3 Deploy Action.

## Where to find builds

- **branch builds**: when a developer pushes a branch, GitHub actions will build and deploy it to `https://collaborative-learning.concord.org/branch/[branch-name]/`. If the branch starts or ends with a number this is automatically stripped off and not included in the folder name.
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
