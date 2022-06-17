## Image Map

The Image Map is a cache used by CLUE to handle image loading. To understand this document it is best to review the document about [images](images.md)

The key of an entry in the cache is its URL. As described in the images doc these URL can be:
- regular http/https
- "local" assets stored in this repository
- special URLs pointing at Firebase Storage or an object in the Firebase Realtime DB.

Entries in the cache have the following properties:
- **contentUrl** the location to download the image from. If the key of the entry is a URL that was modified before downloading this contentUrl contains the modified version.
- **displayUrl** a url to render the actual image, it should be a URL that can be used by the browser. For example the `src` of an `img` or the background of a div in css.
- **width, height** the dimension of the image
- **filename** if the image was loaded from a file, this is the name of the file
- **status** what state the entry is in, see below

Entries in the cache can have 4 status values:
- **Storing**: `getImage` has been called with a URL and this URL is being processed to download and store the image data.
- **ComputingDimensions**: after the image data has been stored, the image is rendered offscreen to find out its dimensions. The resulting dimensions are added as the width and height on the entry
- **Ready**: the image has been stored successfully and the dimensions computed successfully
- **Error**: something went wrong while storing or computing the dimensions

### Methods for working with the cache

There are 2 main ways to work with the cache. Using promises and using MobX observation.

To work with promises, call `getImage` with the URL you want to load. Use `then` or `await` to get its resolved value. It will resolve to the cache entry with a status of either `Ready` or `Error`.  If some other code has called `getImage` before you, the second call will not download the image again, it will wait for the first image to load and then resolve to the same cache entry.

To work with MobX observation, call `getImage` with the URL you want to load. Do not wait for the promise. Instead call `getCachedImage`. The returned entry will initially have a status of `Storing`. This entry can be observed so your code will update when its status, displayURL, and width and height are updated.

### Error Handling

When an error occurs during storing or getting the dimensions, the cache entry will have a status of `Error`.

This error might be because of a network issue, so it could be temporary. It could also indicate the URL is just invalid. Currently no error message is provided. Also the cache does not automatically retry if a store or dimension computation fails.  However code using the cache can call `getImage` again after getting an error and the cache will attempt to store and compute the dimensions again.

If the error happened while computing the dimensions the entry should have a valid displayUrl and might also have a contentUrl.  If the error happened during the storage phase the entry will typically have no contentUrl and its displayUrl will the be the placeholder image.

#### Error Recovery
If getImage is called again for an entry that has a status of Error, the entry will be reset to the storing status. Its properties will be cleared and displayUrl will be the placeholderUrl.

If an error happens during computing dimensions phase, the currentUrl and displayUrl of the content might be set to valid values. However to keep things simple these values are still cleared out when getImage is called again.

#### Current Implementation Notes

The Image Tool has catch block on some getImage calls but not all of them.

geometry-content.tsx has a catch block on one getImage call but not the one that happens during a drop.

geometry-import.ts does not have a catch block on its getImage call. 
FIXME: This brings a up a good point, using the API in observer mode would result in uncaught exceptions if getImage rejected the promise. So either it should not reject, or it needs an option to avoid the reject.

drawing-layer.tsx doesn't have a catch block on all getImage calls

### URL Conversion

In some cases the URL that is sent to `getImage` needs to be converted. Here are the current reasons why:
1. the url is a firebase storage URL. This is a legacy way to store images, so each time one of these is loaded the content of image is uploaded to the firebase realtime database, and this new location has new URL
2. the url is an external url (http/https) in these cases the content is downloaded if possible and then uploaded to the firebase realtime database, this new location has new URL
3. the url is a local asset url and the asset's path has changed. The old asset path might still exist in student documents, so the cache handles changing the old paths into the new ones.
4. the url is a legacy firebase realtime database url that does not include the classhash in the url as described in the images doc. In this case the URL is updated to include the classhash.

When the URL is changed, the cache is updated to contain an entry for both the old URL and the new URL. Both entries will have the new URL as their `contentUrl`.

In some cases it is possible there is a cache entry already at the new URL. This can happen if the new URL was requested directly by some other part of CLUE content. I believe in conversion cases 1 and 2 the new URL will be unique each time so it is not possible for it to conflict. In cases 3 and 4 the new URL could conflict. 

The cache entry for the new URL could be in any of 5 states: undefined or the 4 entry states. And the cache entry being stored at this new location could be in 3 states: Computing Dimensions, Ready, Error. 

Below are the combination of states between the new entry and the existing entry. 

### New cache entry is in Ready state
If the existing entry is 
- `Ready` do nothing
- `Computing Dimensions` this could happen either if the existing entry was created directly by getImage or if the existing entry was created because it is a copy of the original entry due to a URL conversion.  If the existing entry is copy of the original entry then it should be updated.  If the entry existing is not a copy then it should be left alone because there should be another promise updating it. Unlike `Computing Dimensions` an existing entry in the `Storing` state should never be copied due to a URL conversion.
- `Storing` this should mean the existing entry is being updated by another promise, do nothing. If we overwrote the entry we'd kind of be orphaning the promise that was working on updating then entry. And it might mean the entry flips states in an unpredictable manner.
- `Error` update the existing entry with the new entry's fields
- `undefined` store a copy of new entry

### New cache entry is in the Error state
If the existing entry is 
- `Ready` do nothing, the entry was already downloaded successfully leave it alone
- `Computing Dimensions` this could happen either if the existing entry was created directly by getImage or if the existing entry was created because it is a copy of the original entry due to a URL conversion. If the existing entry is copy of the original entry then it should be updated. If the existing entry is not a copy then it should be left alone because there should be another promise updating it.
- `Storing` this should mean the existing entry is being updated right now, do nothing. Hopefully this update of the entry will succeed where the new entry failed. Unlike `Computing Dimensions` an existing entry in the `Storing` state should never be copied due to a URL conversion.
- `Error` do nothing, no point in replacing an error with an error.
- `undefined` do nothing, there isn't a best approach here, but doing nothing simplifies the logic.

### New cache entry is in the Computing Dimensions state
If the existing entry is 
- `Ready` do nothing, the entry was already downloaded successfully leave it alone
- `Computing Dimensions` and `Storing` this should mean the existing entry is being updated right now, do nothing. If we overwrote the entry we'd kind of be orphaning the promise that was working on updating then entry. And it might mean the entry flips states in an unpredictable manner.
- `Error` update the existing entry with the new entry. Also update the promise map so the URL of the existing entry maps to the promise of the new entry. This way if a `getImage` request comes in for existing entry's URL. This request will wait until the new entry promise has resolved.
- `undefined` same as `Error`

## Placeholder image

Currently there is a special placeholder image used by the Image Map and some of the lower level image loading code. The Image Map will set it as the displayUrl if there is an error.

## Filename

The filename of an entry is needed so images that are used more than once in a tile or between multiple tiles can also know the filename. 

For example a student adds a file to the image tile. The ImageMap will upload this image to the firebase realtime database. The entry in the cache will be stored under the URL to the image in the firebase realtime database. The filename might be shown to the user in the image tile. At this point the image tile knows the filename itself so there isn't a need to put it in the image map.  The image tile should store both the URL and the filename in its serialized state so this filename can be shown when the document is reloaded.

Now if this image tile dragged to a new document. The only thing actually transferred is the "content" URL to the image. So this the firebase realtime database URL. The user should still see the filename in the new image tile. This is solved by putting the filename in the cache entry. Now when the new image tile looks up the image in the cache it will know the filename too. 

Because the cache is used this way to transfer the filename, it means when the document is reloaded the cache entries for any of these file based images need to have their filename set again. To support all of this there are two ways the filename can be set:

1. It will be set when an image is first loaded from a file by calling `ImageMap#addFileImage`. 
2. When `getImage` is called the filename can be passed as an additional parameter.

Any tile that stores image URLs in its serialized state also needs to store the filename if it is available. This is because any tile might be the first one to request the image from the image map cache. All following requests will just work with the parameters of the first request. 

For example, the same image is used by a geometry tile and an image tile. To illustrate this lets assume the geometry tile doesn't store the filename. When the document is reloaded, if the geometry tile requested the URL for the image first, an entry will be added to the cache that doesn't have a filename. When the image tile requests the same URL it would get back an entry without a filename. The original image tile could know the filename from its own state. However if the image was copied to another document the new image tile would only have access to the info in the cache entry, so it would not know the filename.

## Dimensions

The width and height of the image entry might not be set. This can happen if you are are observing an entry which has a status of `storing`, `computingDimensions`, or `error`. 

The best approach is for the client using the image map to store the dimensions in its state when they are known. This way when the image is being reloaded the client's components can reserve this space. Now if the entry has a width and height those can be used, otherwise the component falls back to the ones in the state. If the entries width height are different than what is in the state the state should be updated.

When there is an error the cache returns a displayUrl of the placeholder image. But it doesn't return its dimensions. This is intentional. The error might be temporary (network glitch), so this allows the client to stick with any known dimensions. This prevents resizing or shifting when the actual image is loaded.

### Current Implementation Notes on Dimensions

The Image Tool uses the computed height to request a height from its tool tile wrapper.
Otherwise, it doesn't seem to use the width or height, it seems like it is just letting the 
browser size the image based on the tool tile wrapper.
If the height is not set then the desired height is undefined so no request is made

geometry-content.tsx only partially handles image dimensions the code in the debouncing update ignores them. But code in tile drop and uploading background image also handles them. 
It assumes the width and height are set with: 
  `const width = image.width! / kGeometryDefaultPixelsPerUnit;`
Because this is in a getImage handler, it should mean it won't get a entry computing dimensions. But it might get one that has error'd.  
FIXME: We should update this code so it can handles unset this would be the only place that does this. And I think it is better if the error entry doesn't set them. That way clients can use their existing dimensions to display the displayURL (a placeholder if an error) when they aren't available. Currently the width and height will be set to NaN.

jxg-image is getting a size from the internal object. it doesn't use the dimensions of the imageEntry that it gets using getCachedImage. Instead it just uses the size that was set above. 

drawing-layer.tsx (old version) assumes the image has a width and height. MST will throw an error in this code if there is an error and an image is returned without width and height

drawing-tool/objects/image.tsx this handles the case when the map entry doesn't have a width or height. It only updates its own image object width and height if they are set. So otherwise the width and height of the saved entry should be used.

## Error Catching

