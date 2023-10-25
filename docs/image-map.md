# Image Map

The Image Map is a cache used by CLUE to handle image loading. To understand this document it is best to review the document about [images](images.md).

The key of an entry in the cache is its URL. As described in the images doc these URLs can be:
- regular http/https URLs
- "local" assets stored in the authored curriculum repository (generally curriculum images)
- special URLs pointing at Firebase Storage or an object in the Firebase Realtime DB.

Entries in the cache have the following properties:
- **contentUrl** the location to download the image from. This URL might not be something the browser can handle directly. If the key of the entry is a URL that was modified before downloading, this contentUrl contains the modified version.
- **displayUrl** a url to render the actual image, it should be a URL that can be used by the browser. For example the `src` of an `img` or the background of a `div` in CSS.
- **width, height** the dimension of the image
- **filename** if the image was loaded from a file, this is the name of the file
- **status** what state the entry is in, see below
- **retries** how many times `getImage` has tried to store the image after a previous attempt

Entries in the cache can have 4 status values:
- **PendingStorage**: `getImage` has been called with a URL and this URL is being processed to download and store the image data.
- **PendingDimensions**: after the image data has been stored, the image is rendered offscreen to find out its dimensions. The resulting dimensions are added as the width and height on the entry
- **Ready**: the image has been stored successfully and the dimensions computed successfully
- **Error**: something went wrong while storing or computing the dimensions

## Methods for working with the cache

There are 2 main ways to work with the cache. Using promises and using MobX observation.

To work with promises, call `getImage` with the URL you want to load. Use `then` or `await` to get its resolved value. It will resolve to the cache entry with a status of either `Ready` or `Error`.  If some other code has called `getImage` before you, the call will not download the image again. It will wait for the first image to load and then resolve to the same cache entry.

To work with MobX observation, call `getImage` with the URL you want to load. Do not wait for the promise. Instead call `getCachedImage`. The returned entry will initially have a status of `PendingStorage`. This entry can be observed so your code will update when its status, displayURL, and width and height are updated.

## Error Handling

When an error occurs during storing or getting the dimensions, the cache entry will have a status of `Error`.

This error might be because of a network issue, so it could be temporary. It could also indicate the URL is invalid. Currently no error message is provided. Also the cache does not automatically retry if a store or dimension computation fails.  However code using the cache can call `getImage` again and the cache will attempt to store and compute the dimensions again.

If the error happened while computing the dimensions the entry should have a valid displayUrl and might also have a contentUrl.  If the error happened during the storage phase the entry will typically have no contentUrl and its displayUrl will the be the placeholder image.

The promise should not be rejected unless there is a bug in the code. This is because getImage is intended to work both in the promise approach and in the observer approach. Using the observer approach there would be no catch block on getImage, so the browser would report an unhandled promise error if the promise was rejected.

### Error Recovery
If `getImage` is called again for an entry that has a status of `Error`, the entry will be reset to the `PendingStorage` status. Its properties will be cleared and `displayUrl` will be the `placeholderUrl`.

If an error happens during the `PendingDimensions` phase, the currentUrl and displayUrl of the content might be set to valid values. However to keep things simple these values are still cleared out when getImage is called again.

## URL Conversion

In some cases the URL that is sent to `getImage` needs to be converted. Here are the current reasons why:
1. the url is a firebase storage URL. This is a legacy way to store images, so each time one of these is loaded the content of image is uploaded to the firebase realtime database.
2. the url is an external url (http/https) in these cases the content is downloaded if possible and then uploaded to the firebase realtime database.
3. the url is a local asset url and the asset's path has changed. The old asset path might still exist in student documents, so the cache handles changing the old paths into the new ones.
4. the url is a legacy firebase realtime database url that does not include the classhash in the url as described in the images doc. In this case the URL is updated to include the classhash.

When the URL is changed, the cache is updated to contain an entry for both the old URL and the new URL. Both entries will have the new URL as their `contentUrl`.

In some cases it is possible there is a cache entry already at the new URL. This can happen if the new URL was requested directly by some other part of CLUE content. I believe in conversion cases 1 and 2 the new URL will be unique each time so it is not possible for it to conflict. In cases 3 and 4 the new URL could conflict.

The cache entry for the new URL could be in any of 5 states: undefined or the 4 status states described above. And the cache entry being stored at this new location could be in 3 states: `PendingDimensions`, `Ready`, `Error`. When the cache entry has a status of `PendingStorage`, the converted URL is not known yet.

Below are the combination of states between the updated entry and the existing entry.

### Updated cache entry is in Ready state
If the existing entry is
- `Ready` do nothing
- `PendingDimensions` this could happen either if:
  1. the existing entry was created directly by `getImage`. In this case the existing entry should be left alone because there should be another promise updating it.
  2. the existing entry was created because it is a copy of the updated entry that was made after the updated entry was stored before its dimensions were computed. In this case the existing entry should be updated because it is essentially managed by the current promise.
- `PendingStorage` this should mean the existing entry is being updated by another promise, do nothing. Unlike `PendingDimensions` an existing entry in the `PendingStorage` state should never be a copy due to a URL conversion.
- `Error` update the existing entry with the updated entry's fields
- `undefined` store a copy of the updated entry

### Updated cache entry is in the PendingDimensions state
If the existing entry is
- `Ready` do nothing, the entry was already downloaded successfully leave it alone
- `PendingDimensions` and `PendingStorage` this should mean the existing entry is being updated right now by a different promise, do nothing. Unlike when the updated cache entry is in the `Error` or `Ready` state, in this case the updated cache entry should not have been copied yet, so it can't managed by the same promise.
- `Error` update the existing entry with the new entry. Also update the promise map so the URL of the existing entry maps to the promise of the updated entry. This way if a `getImage` request comes in for the existing entry's URL, this request will wait until the updated entry's promise has resolved.
- `undefined` same as `Error`

### Updated cache entry is in the Error state
If the existing entry is
- `Ready` do nothing, the entry was already downloaded successfully leave it alone
- `PendingDimensions` this could happen either if:
  1. the existing entry was created directly by `getImage`. In this case the existing entry should be left alone because there should be another promise updating it.
  2. the existing entry was created because it is a copy of the updated entry that was made after the updated entry was stored before its dimensions were computed. In this case the existing entry should be updated because it is essentially managed by the current promise.
- `PendingStorage` this should mean the existing entry is being updated right now, do nothing. Hopefully this update of the entry will succeed where the new entry failed. Unlike `PendingDimensions` an existing entry in the `PendingStorage` state should never be a copy due to a URL conversion.
- `Error` do nothing, no point in replacing an error with an error.
- `undefined` do nothing, no point is adding a error entry where one didn't exist before.

### Notes on conversion of local/relative asset URLs
Authored curriculum content was originally located at src/public/curriculum in the CLUE code repository. In 2023, the curriculum content was split off into its own repository named clue-curriculum. That separate repository includes many asset files used within the authored content. CLUE now imports most authored content from this external repository, the deployed version of which is currently located at https://models-resources.concord.org/clue-curriculum.

ImageMap's `localAssetsImagesHandler` converts relative asset URLs that appear in content (e.g., sas/images/image.png) to full URLs (e.g. https://models-resources.concord.org/clue-curriculum/branch/main/sas/images/image.png) so the images properly load within CLUE.

`localAssetsImageHandler` also includes special handling of legacy relative URLs. When authored content was part of the CLUE code repository, relative asset URLs in the authored content started with `curriculum/[full-name-of-unit]`. For example:`curriculum/stretching-and-shrinking/images/1.png`. `localAssetsImageHandler` makes sure to convert any URLs that start with `curriculum/` so they resolve to full URLs that will work within CLUE. That means removing `curriculum/`, converting the `[full-name-of-unit]` value to its corresponding unit code value (e.g. `stretching-and-shrinking` becomes `sas`), and then prepending the deployed curriculum repository's base URL plus branch (`branch/main/` is the default).

## Placeholder image

Currently there is a special placeholder image used by the Image Map and some of the lower level image loading code. The Image Map will set it as the displayUrl if there is an error during storing. If there is an error during computing the dimensions the displayUrl should be a URL that should represent the actual image content.

## Filename

The filename of an entry is needed so images that are used more than once in a tile or between multiple tiles can also know the filename.

For example a student adds a file to the image tile. The ImageMap will upload this image to the firebase realtime database. The entry in the ImageMap cache will be stored under the URL to the image in the firebase realtime database. The filename might be shown to the user in the image tile. At this point the image tile knows the filename itself so there isn't a need to put it in the image map.  The image tile should store both the URL and the filename in its serialized state so this filename can be shown when the document is reloaded.

Now if this image tile is dragged to a new document. The only thing actually transferred is the "content" URL to the image. This is the firebase realtime database URL. The user should still see the filename in the new image tile, this filename is taken from the ImageMap cache entry that was stored when the file was uploaded. Now when the new image tile looks up the image in the cache it will know the filename too.

Because the cache is used this way to transfer the filename, it means when the document is reloaded the cache entries for any of these file based images need to have their filename set again. To support all of this there are two ways the filename can be set:

1. It will be set when an image is first loaded from a file by calling `ImageMap#addFileImage`.
2. When `getImage` is called, the filename can be passed as an additional parameter.

Any tile that stores image URLs in its serialized state also needs to store the filename if it is available. This is because any tile might be the first one to request the image from the ImageMap cache. All following requests will just work with the parameters of the first request.

For example, the same image is used by a geometry tile and an image tile. To illustrate this let's assume the geometry tile doesn't store the filename. When the document is reloaded, if the geometry tile requested the URL for the image first, an entry will be added to the cache that doesn't have a filename. When the image tile requests the same URL it would get back an entry without a filename. This original image tile could know the filename from its own state. However if the image was then copied to another document the new image tile would only have access to the info in the cache entry, so it would not know the filename.

## Dimensions

The width and height of the image entry might not be set. This can happen if you are are observing an entry which has a status of `PendingStorage`, `PendingDimensions`, or `Error`.

The best approach is for the client using the image map to store the dimensions in its state when they are known. This way when the image is being reloaded the client's components can reserve this space. Now if the entry has a width and height those can be used, otherwise the component falls back to the width and height in the state. If the entries width height are different than what is in the state the state should be updated.

When there is an error the cache returns a displayUrl of the placeholder image. But it doesn't return its dimensions. This is intentional. The error might be temporary (network glitch), so this allows the client to stick with any known dimensions. This prevents resizing or shifting when the actual image is loaded.

### Current Implementation Notes on Dimensions

The Image tile uses the computed height to request a height from its tile wrapper.
Otherwise, it doesn't seem to use the width or height, it seems like it is just letting the
browser size the image based on the tile wrapper.
If the height is not set then the desired height is undefined so no request is made

geometry-content.tsx only partially handles image dimensions the code in the debouncing update ignores them. But code in tile drop and uploading background image also handles them.
It assumes the width and height are set with:
  `const width = image.width! / kGeometryDefaultPixelsPerUnit;`
Because this is in a `getImage` handler, it should mean it won't get a entry with a status of `PendingDimensions`. But it might get one that has a status of `Error`.
FIXME: We should update this code so it handles undefined width and height values. It seems best to work on this in follow up PR.

jxg-image (a part of the geometry tile) is getting a size from the internal object. it doesn't use the dimensions of the imageEntry that it gets using getCachedImage. Instead it just uses the size that was set above.

drawing-layer.tsx (old version) assumes the image has a width and height. MST will throw an error in this code if there is an error and an image is returned without width and height. FIXME: This issue should be fixed in the new version.

drawing-tool/objects/image.tsx this handles the case when the map entry doesn't have a width or height. It only updates its own image object width and height if they are set. So otherwise the width and height of the saved entry should be used.

# Update

TODO:
- x check that I can test image upload in the image tile
- add new action to uploadFile, it should return the imageMapEntry as well as the promise
- switch the image tile to use the new approach
- look for cypress tests of the image tile

Notes:
There isn't a good approach for using the observer approach and also updating the contentUrl stored in model state. Since this contentUrl can change after the initial image load for example on a file upload or when accessing an old image that needs to migrated to the newer URL style. The drawing tool seems to ignore this all together. Other tiles wait for the entry to finish loading and then they update their URLs.

Here are some options for this:
- models support image map entries in places of URLs for their URLs. Then when they are serialized (getSnapshot) the URL, filename, and dimensions would be written out. This requires more refactoring since we can't put an image map entry in two trees at the same time. So if the entries were converted to basic MobX objects instead of MST objects this would work with a custom serializer.
- a postSnapshot handler. The initial URL is left in the model until it is serialized. This handler would look up the entry given the stored url, and then write out the contentUrl. Downside of this is that that the conversion would have to happen each time, and if the object was never accessed by a component the image map might not have the updated contentURL, so getting this contentURL could slow down the serialization. Probably in this case we'd want to not trigger a image fetch.
- the model has an action for updating the image, and this action adds a MobX `when` observer to monitor when the entry is ready. At that point it updates the stored URL.

The first option might cause problems for undo redo, it would depend on what is stored when the image map entry is first set.
The 2nd option might also have problems with undo redo. If the url put in the model is a blob URL and that is changed when the model is serialized, this blob URL would be stored in the undo history. So now when replaying the history in a new session this blob URL would be invalid.
The 3rd option would cause an async undo/history action. We could use without undo, but that would cause the history to store the blob URL again. What we want is a flow. If it used a flow and waited for the `when` to finish (or we provided additional ways to add listeners to entries), then there would just be a single history entry that contained the final URL. So this 3rd option seems best.
