import { types, Instance, SnapshotIn, clone, getSnapshot, flow, IMSTMap, ISimpleType } from "mobx-state-tree";
import {
  getImageDimensions, IImageDimensions, ISimpleImage, isPlaceholderImage, storeCorsImage, storeFileImage, storeImage
} from "../utilities/image-utils";
import { DB } from "../lib/db";
import { DEBUG_IMAGES } from "../lib/debug";
import placeholderImage from "../assets/image_placeholder.png";
import { getAssetUrl } from "../utilities/asset-utils";

export const kExternalUrlHandlerName = "externalUrl";
export const kLocalAssetsHandlerName = "localAssets";
export const kFirebaseStorageHandlerName = "firebaseStorage";
export const kFirebaseRealTimeDBHandlerName = "firebaseRealTimeDB";

export enum EntryStatus {
  PendingStorage = "pendingStorage",
  PendingDimensions = "pendingDimensions",
  Ready = "ready",
  Error = "error"
}

export const ImageMapEntry = types
  .model("ImageEntry", {
    filename: types.maybe(types.string),
    contentUrl: types.maybe(types.string),
    displayUrl: types.maybe(types.string),
    width: types.maybe(types.number),
    height: types.maybe(types.number),
    status: types.enumeration<EntryStatus>("EntryStatus", Object.values(EntryStatus)),
    retries: 0
  });
export type ImageMapEntryType = Instance<typeof ImageMapEntry>;
export type ImageMapEntrySnapshot = SnapshotIn<typeof ImageMapEntry>;

export interface IImageContext {
  type?: string;
  key?: string;
}
export interface IImageBaseOptions {
  filename?: string;
}
export interface IImageHandlerStoreOptions extends IImageBaseOptions {
  db?: DB;
}
export interface IImageHandlerStoreResult {
  filename?: string;
  contentUrl?: string;
  displayUrl?: string;
  success: boolean;
}
interface IImageMap {
  unitCodeMap?: IMSTMap<ISimpleType<string>>;
  curriculumUrl?: string;
}
export interface IImageHandler {
  imageMap: IImageMap;
  name: string;
  priority: number;
  match: (url: string) => boolean;
  store: (url: string, options?: IImageHandlerStoreOptions) => Promise<IImageHandlerStoreResult>;
}
// map from image url => component id => listener function
export type ImageListenerMap = Record<string, Record<string, () => void>>;

export const ImageMapModel = types
  .model("ImageMap", {
    images: types.map(ImageMapEntry),
    unitCodeMap: types.maybe(types.map(types.string)),
    unitUrl: types.maybe(types.string)
  })
  .volatile(self => ({
    handlers: [] as IImageHandler[],
    storingPromises: {} as Record<string, Promise<ImageMapEntryType>>
  }))
  .views(self => ({
    isImageUrl(url: string) {
      return !!this.getHandler(url);
    },
    hasImage(url: string) {
      return self.images.has(url);
    },
    getHandler(url: string) {
      const index = self.handlers.findIndex(handler => handler.match(url));
      return index >= 0 ? self.handlers[index] : undefined;
    },
    isExternalUrl(url: string) {
      const index = self.handlers.findIndex(handler => handler.match(url));
      return (index >= 0) &&
              (self.handlers[index].name === kExternalUrlHandlerName);
    },
    isPlaceholder(url: string) {
      return isPlaceholderImage(url);
    },
    getCachedImage(url?: string) {
      return url ? self.images.get(url) : undefined;
    },
    get curriculumUrl() {
      if (!self.unitUrl) return;
      return (new URL("../", self.unitUrl)).href;
    }
  }))
  .actions(self => ({
    registerHandler(handler: IImageHandler) {
      handler.imageMap = self;
      self.handlers.push(handler);
      self.handlers.sort((a, b) => {
        return (b.priority || 0) - (a.priority || 0);
      });
    },

    _syncContentUrl(url: string, entry: ImageMapEntryType) {
      if (!entry.contentUrl || (url === entry.contentUrl)) {
        return;
      }

      // See image-map.md "URL Conversion" for a fully fleshed out description
      // of this logic.
      const existingEntry = self.images.get(entry.contentUrl);
      if (!existingEntry || existingEntry.status === EntryStatus.Error) {
        if (entry.status === EntryStatus.Ready) {
          // store or update the entry
          self.images.set(entry.contentUrl, getSnapshot(entry));
        }
        else if (entry.status === EntryStatus.PendingDimensions) {
          // store or update the entry
          self.images.set(entry.contentUrl, getSnapshot(entry));
          // copy the storing promise incase some code calls
          // getImage(entry.contentUrl)
          self.storingPromises[entry.contentUrl] = self.storingPromises[url];
        }
      }

      if (existingEntry?.status === EntryStatus.PendingDimensions &&
          (entry.status === EntryStatus.Error || entry.status === EntryStatus.Ready) &&
          self.storingPromises[url] === self.storingPromises[entry.contentUrl]) {
        // If the existingEntry is "managed" by the same promise as the entry
        // we should updated it in some cases.
        // See image-map.md "Updated Cache entry is in the Error state" and
        // "Updated cache entry is in Ready state"
        self.images.set(entry.contentUrl, getSnapshot(entry));
      }
    },
    setUnitUrl(url: string) {
      self.unitUrl = url;
    },
    setUnitCodeMap(map: any) {
      self.unitCodeMap = map;
    }
  }))
  .actions(self => ({
    // Flows are the recommended way to deal with async actions in MobX and MobX State Tree.
    // However, typing them is difficult. If you leave them untyped like:
    // `flow(function* addImage(url: string, snapshot: ImageMapEntrySnapshot) {`
    // The return value will be a Promise based on the actual return value of the generator
    // function. This means there is no enforcement of a particular return type.
    // Also the value of all yield calls is any.
    //
    // The approach used below types the generator function with:
    //   Generator<PromiseLike<any>, ImageMapEntryType, unknown>
    // which means:
    // - the value passed to yield has to be PromiseLike<any>
    // - the return type has to be ImageMapEntryType
    // - yield returns an unknown type so you have to cast it before using it
    //
    // Ignoring the return value of yield there are two other options for enforcing the return
    // value of the flow:
    // - `flow<ImageMapEntryType, any>(function* addImage(url: string, snapshot: ImageMapEntrySnapshot) {`
    // - `flow<ImageMapEntryType, [string, ImageMapEntrySnapshot]>(function* addImage(url, snapshot) {`
    // The first option looks nice because the arguments are typed as normal, however it means the actual
    // action will have un typed arguments
    // The second results in a weird signature where the argument names of addImage are just arg0, arg1
    // In both of these cases the return value of yield is any so it is not as safe as the Generator
    // approach being used.
    //
    // There is also the yield* toGenerator approach https://mobx-state-tree.js.org/API/#togenerator which
    // provides a way to automatically type the return value of the yield. But that doesn't solve
    // the problem of typing the return value of the flow.
    _addImage: flow(function* _addImage(url: string, storeResult: IImageHandlerStoreResult)
                              : Generator<PromiseLike<any>, ImageMapEntryType, unknown> {

      if (!storeResult.displayUrl) {
        // As far as I can tell it should be an error if the displayUrl
        // is not set. Even when there is an error the displayUrl should be
        // set to the placeholderImage.
        console.error(`addImage called with a storeResult without an displayUrl. ` +
          `url: ${url}, contentUrl: ${storeResult.contentUrl}, success: ${storeResult.success}`);

        // We still store the entry but we update it to be errored.
        storeResult.success = false;
      }

      // Update or add the entry. We do this whether there is an error or not.
      // If there is an error it is still recorded so observers of the entry
      // will see the change
      // If there is an existing entry we copy the retries property
      const existingEntry = self.images.get(url);
      let retries = 0;
      if (existingEntry) {
        retries = existingEntry.retries;
      }
      const { success: successfulStore, ...otherProps } = storeResult;
      const snapshot: ImageMapEntrySnapshot = {
        ...otherProps,
        status: successfulStore ? EntryStatus.PendingDimensions : EntryStatus.Error,
        retries
      };
      self.images.set(url, snapshot);

      const entry = self.images.get(url)!;

      if (entry.status === EntryStatus.Error) {
        // This means the storage operation failed.

        // We could clear the storingPromise here, but instead we just leave it and
        // rely on getImage to ignore the storingPromise when it sees there is
        // an entry with a status of error.

        // Even if this entry has a contentUrl that is different than its url
        // we do not update the entry at the contentUrl.
        // See image-map.md "Updated cache entry is in the Error state"
        // Note: when there is an error at this point the promise that is managing
        // this call to _addImage should not be responsible for the entry at
        // contentUrl.

        // We return so we don't sync and don't try to get the dimensions
        // See image-map.md "Dimensions" for why we don't set the dimensions
        return entry;
      }

      self._syncContentUrl(url, entry);

      try {
        // If the getImageDimension image element never loads or errors then we won't get
        // past this line. However I'd hope that the browser will eventually trigger
        // one of those events.
        // In most cases _addImage is not called until the image has already been
        // downloaded and displayUrl is actually a blob url.
        // So it should be unlikely in these cases that getImageDimensions will fail.
        //
        // We know the entry.displayUrl is defined because we made sure the snapshot.displayUrl
        // is defined above.
        const dimensions = (yield getImageDimensions(entry.displayUrl!)) as IImageDimensions;
        entry.width = dimensions.width;
        entry.height = dimensions.height;
        entry.status = EntryStatus.Ready;
      } catch (error) {
        entry.status = EntryStatus.Error;
        // If there is a contentUrl there could be a second entry that needs to be updated.
        // syncContentUrl takes care of this

        // Note: we are not updating or clearing the other fields of the entry here
        // Its status will be Error, but it might have a contentUrl and a displayUrl.
        // Leaving the contentUrl in place is necessary so syncContentUrl can work.
        // Leaving displayUrl untouched might not be the best thing to do, but there
        // isn't a good reason to change it so far.
      }

      self._syncContentUrl(url, entry);
      return entry;
    })
  }))
  .actions(self => {
    let _db: DB;

    return {
      afterCreate() {
        // placeholder doesn't have contentUrl
        self._addImage(
          placeholderImage,
          { displayUrl: placeholderImage, success: true }
        );

        self.registerHandler(firebaseRealTimeDBImagesHandler);
        self.registerHandler(firebaseStorageImagesHandler);
        self.registerHandler(localAssetsImagesHandler);
        self.registerHandler(externalUrlImagesHandler);
      },

      initialize(db: DB) {
        _db = db;
      },

      addFileImage: flow(function* (file: File): Generator<PromiseLike<any>, Promise<ImageMapEntryType>, unknown> {
        const simpleImage = (yield storeFileImage(_db, file)) as ISimpleImage;
        const { normalized } = parseFauxFirebaseRTDBUrl(simpleImage.imageUrl);
        const entry: IImageHandlerStoreResult = {
                filename: file.name,
                contentUrl: normalized,
                displayUrl: simpleImage.imageData,
                success: true
              };
        return self._addImage(entry.contentUrl!, entry);
      }),

      _storeAndAddImage: flow(function* (
          url: string,
          handler: IImageHandler,
          options?: IImageBaseOptions
        ): Generator<PromiseLike<any>, ImageMapEntryType | Promise<ImageMapEntryType>, unknown> {
        const storeResult = (yield handler.store(url, { db: _db, ...options })) as IImageHandlerStoreResult;
        return self._addImage(url, storeResult);
      }),
    };
  })
  .actions(self => ({
    // eslint-disable-next-line require-yield
    getImage: flow(function* (url: string, options?: IImageBaseOptions)
                    : Generator<PromiseLike<any>, ImageMapEntryType | Promise<ImageMapEntryType>, unknown> {
      if (!url) {
        // TODO: how often does this happen, should it be silently ignored like this?
        console.warn("ImageMap#getImage called with a falsy URL", url);
        return clone(self.images.get(placeholderImage)!);
      }

      const imageEntry = self.images.get(url);
      if (imageEntry?.status === EntryStatus.Ready) {
        // This image has been downloaded successfully already
        return imageEntry;
      }

      const existingStoringPromise = self.storingPromises[url];
      if ( existingStoringPromise &&
           ( imageEntry?.status !== EntryStatus.Error || imageEntry?.retries >= 2 ) ) {
        // If the imageEntry is errored we ignore the existing promise
        // This way a second getImage request will try to store the image again
        // If we've already retried storing the image 2 times, don't try again.
        return existingStoringPromise;
      }

      const handler = self.getHandler(url);
      if (!handler) {
        console.warn(`No handler found for ${url}`);
        return clone(self.images.get(placeholderImage)!);
      }

      // If there is an existing entry we'll overwrite it so its status is
      // `PendingStorage` and the `displayUrl` is the placeholder. In theory the
      // existingEntry could have a status of PendingStorage, PendingDimensions, or
      // Error. Because there is no existingStoringPromise the status should
      // really not be PendingStorage or PendingDimensions.
      if (imageEntry?.status === EntryStatus.PendingStorage ||
          imageEntry?.status === EntryStatus.PendingDimensions) {
        console.warn(`ImageMap.getImage found an entry with a status ${imageEntry.status} at ${url}`);
      }

      let retries = 0;
      if (imageEntry) {
        // When we have an imageEntry at this point it means we are retrying
        retries = imageEntry.retries + 1;
      }

      self.images.set(url, { status: EntryStatus.PendingStorage, displayUrl: placeholderImage,
        retries });

      const storingPromise = self._storeAndAddImage(url, handler, options);

      // keep track of the storingPromise
      self.storingPromises[url] = storingPromise;

      return storingPromise;
    })
  }))
  .views(self => ({
    getImageEntry(url?: string, options?: IImageBaseOptions) {
      if (!url) {
        console.warn("ImageMap#getImageEntry called with a falsy URL", url);
        return undefined;
      }

      self.getImage(url, options);
      return self.getCachedImage(url);
    }
  }));

export type ImageMapModelType = Instance<typeof ImageMapModel>;

/*
 * externalUrlImagesHandler
 */
export const externalUrlImagesHandler: IImageHandler = {
  name: kExternalUrlHandlerName,
  priority: 1,

  match(url: string) {
    return url ? /^(https?:\/\/|data:image\/)/.test(url) : false;
  },

  async store(url: string, options?: IImageHandlerStoreOptions): Promise<IImageHandlerStoreResult> {
    const { db } = options || {};
    // upload images from external urls to our own firebase if possible
    // this may fail depending on CORS settings on target image.
    // After the data of the image is uploaded to firebase, it is not
    // explicitly downloaded again:
    // 1. storeImage creates a canvas and adds the url to this canvas
    // 2. a data uri is extracted from the canvas
    // 3. an object with the data uri is uploaded to firebase
    // 4. the data uri is "fetched" to turn it into a blob and then blob url
    // 5. the resulting imageData value will be the blob url
    // 6. the displayUrl is set to this blob url
    // In the context of authoring, db.stores is undefined and we consequently
    // do not upload any images added via the CMS.
    if (db?.stores?.user.id) {
      try {
        const simpleImage = await storeImage(db, url);
        if (isPlaceholderImage(simpleImage.imageUrl)) {
          // conversion errors are resolved to placeholder image
          // this generally occurs due to a CORS error, in which
          // case we just use the original url.
          //
          // TODO: if we get a CORS error we'll likely get that same
          // error again. So we should serialize that info and use it
          // to not try to download the image again.
          return { contentUrl: url, displayUrl: url, success: true };
        }
        else {
          const { normalized } = parseFauxFirebaseRTDBUrl(simpleImage.imageUrl);
          return { contentUrl: normalized, displayUrl: simpleImage.imageData,
            success: true  };
        }
      } catch (error) {
        // If the silent upload has failed, do we retain the full url or
        // encourage the user to download a copy and re-upload?
        // For now, return the original image url.
        return { contentUrl: url, displayUrl: url, success: true };
      }
    }
    else {
      // For now, return the original image url.
      return { contentUrl: url, displayUrl: url, success: true };
    }
  },
  imageMap: {}
};

/*
 * localAssetsImagesHandler
 */
export const localAssetsImagesHandler: IImageHandler = {
  name: kLocalAssetsHandlerName,
  priority: 2,

  match(url: string) {
           // don't match values with a protocol or port specified
    return !/:/.test(url) &&
           // or legacy firebase storage references
           !/^\/.+\/portals\/.+$/.test(url) &&
           // make sure there's at least one slash
           /\//.test(url) &&
           // make sure value ends with a file extension
           /\.[a-z0-9]+$/i.test(url);
  },

  async store(url: string, options?: IImageHandlerStoreOptions): Promise<IImageHandlerStoreResult> {
    // Legacy curriculum units lived in the defunct "curriculum" directory in subfolders
    // named after the unit title, e.g. "curriculum/stretching-and-shrinking". References
    // to files in those directories need to be converted to use the new file structure
    // where the unit code is the directory name, e.g. "sas".
    const urlPieces = url.match(/curriculum\/([^/]+)\/(.*)/);
    let _url = url;
    if (urlPieces && this.imageMap.unitCodeMap) {
      const urlUnitDir = urlPieces[1];
      const newUnitDir = this.imageMap.unitCodeMap.get(urlUnitDir) || urlUnitDir;
      _url = `${newUnitDir}/${urlPieces[2]}`;
    }
    // We also need to convert legacy drawing tool stamp paths
    _url = _url.replace("assets/tools/drawing-tool/stamps", "msa/stamps");

    // If curriculumUrl is defined and the image isn't in CLUE's own assets directory,
    // build an absolute URL for the displayUrl.
    const displayUrl = this.imageMap.curriculumUrl && !/^assets\//.test(_url)
                         ? new URL(_url, this.imageMap.curriculumUrl).href
                         : getAssetUrl(_url);
    return { filename: options?.filename, contentUrl: _url, displayUrl, success: true };
  },
  imageMap: {}
};

/*
 * firebaseStorageImagesHandler
 */
const kFirebaseStorageUrlPrefix = "https://firebasestorage.googleapis.com";

// The contentUrl is not set here.
// This means any content that is referencing an image that cannot be downloaded
// will not be updated. Modifying content like this seems kind of dangerous because
// this could be a temporary network error.
// By not setting the contentUrl, it also means that the default placeholder image
// entry will not be modified by syncContentUrl. That is a good thing.
const kErrorStorageResult: IImageHandlerStoreResult = {
  displayUrl: placeholderImage, success: false
};

export const firebaseStorageImagesHandler: IImageHandler = {
  name: kFirebaseStorageHandlerName,
  priority: 3,

  match(url: string) {
    return url.startsWith(kFirebaseStorageUrlPrefix) ||
      // original firebase storage path reference
      /^\/.+\/portals\/.+$/.test(url);
  },

  async store(url: string, options?: IImageHandlerStoreOptions): Promise<IImageHandlerStoreResult> {
    const { db } = options || {};
    // All images from firebase storage must be migrated to realtime database
    const isStorageUrl = url.startsWith(kFirebaseStorageUrlPrefix);
    const storageUrl = url.startsWith(kFirebaseStorageUrlPrefix) ? url : undefined;
    const storagePath = !isStorageUrl ? url : undefined;
    // Pass in the imagePath as the second argument to get the ref to firebase storage by url
    // This is needed if an image of the same name has been uploaded in two different components,
    // since each public URL becomes invalid and a new url generated on upload
    if (db?.stores.user.id) {
      try {
        const newUrl = await db.firebase.getPublicUrlFromStore(storagePath, storageUrl);

        if (newUrl) {
          const simpleImage = await storeCorsImage(db, newUrl);
          // Image has been retrieved from Storage, now we can safely remove the old image
          // TODO: remove old images
          const { normalized } = parseFauxFirebaseRTDBUrl(simpleImage.imageUrl);
          return { contentUrl: normalized, displayUrl: simpleImage.imageData,
            success: true };
        }
        else {
          return kErrorStorageResult;
        }
      } catch (error) {
        return kErrorStorageResult;
      }
    }
    else {
      return kErrorStorageResult;
    }
  },
  imageMap: {}
};

/*
 * firebaseRealTimeDBImagesHandler
 */
const kCCImageScheme = "ccimg";
const kFirebaseRTDBFauxHost = "fbrtdb.concord.org";
const kFirebaseRTDBEscFauxHost = kFirebaseRTDBFauxHost.replace(/\./g, "\\.");
const kFirebaseRTDBFauxUrlPrefix = `${kCCImageScheme}://${kFirebaseRTDBFauxHost}`;
const kFirebaseRTDBFauxUrlRegex = new RegExp(`^${kCCImageScheme}://(${kFirebaseRTDBEscFauxHost}/)?(.*)`);

function createFirebaseRTDBFauxUrl(path: string) {
  return `${kFirebaseRTDBFauxUrlPrefix}/${path}`;
}
function extractPathFromFirebaseRTDBFauxUrl(url: string) {
  const match = kFirebaseRTDBFauxUrlRegex.exec(url);
  return match && match[2] || undefined;
}
function parseImagePath(path: string) {
  const match = /([^/]+)\/([^/]+)/.exec(path);
  const classHash = match?.[1] || undefined;
  const imageKey = match?.[2] || undefined;
  return { classHash, imageKey };
}
function parseFauxFirebaseRTDBUrl(url: string) {
  const path = extractPathFromFirebaseRTDBFauxUrl(url) || undefined;
  const { classHash, imageKey } = path ? parseImagePath(path) : {} as any;
  const normalized = path && createFirebaseRTDBFauxUrl(path);
  return { path, classHash, imageKey, normalized };
}

export const firebaseRealTimeDBImagesHandler: IImageHandler = {
  name: kFirebaseRealTimeDBHandlerName,
  priority: 4,

  match(url: string) {
    return url.startsWith(kFirebaseRTDBFauxUrlPrefix) ||
      (url.startsWith(`${kCCImageScheme}://`) && (url.indexOf("concord.org") < 0));
  },

  async store(url: string, options?: IImageHandlerStoreOptions): Promise<IImageHandlerStoreResult> {
    const { db } = options || {};
    const { path, classHash, imageKey, normalized } = parseFauxFirebaseRTDBUrl(url);

    if (db && path && normalized) {
      // In theory we could direct all firebase image requests to the cloud function,
      // but only cross-class supports require the use of the cloud function.
      const blobUrl = classHash !== db.stores.user.classHash
        ? await db.getCloudImageBlob(normalized)
        : await db.getImageBlob(imageKey);
      return blobUrl
        ? {
          filename: options?.filename, contentUrl: normalized, displayUrl: blobUrl,
          success: true
        }
        // Note: we used to return an empty image entry here. This used to cause
        // problems with some code that would then try to load the original url which
        // might be a ccimg: url.
        // This empty entry seems to also be expected by jxg-image which was testing
        // for falsey displayUrl. It has been updated to also check the status of the
        // entry
        : kErrorStorageResult;
    }
    else {
      return kErrorStorageResult;
    }
  },
  imageMap: {}
};

export const gImageMap = ImageMapModel.create();
if (DEBUG_IMAGES) {
  (window as any).imageMap = gImageMap;
}
