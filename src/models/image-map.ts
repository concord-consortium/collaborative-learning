import { types, Instance, SnapshotIn, clone, getSnapshot, flow, applyPatch, applySnapshot } from "mobx-state-tree";
import {
  getImageDimensions, IImageDimensions, ISimpleImage, isPlaceholderImage, storeCorsImage, storeFileImage, storeImage
} from "../utilities/image-utils";
import { DB } from "../lib/db";
import placeholderImage from "../assets/image_placeholder.png";

export const kExternalUrlHandlerName = "externalUrl";
export const kLocalAssetsHandlerName = "localAssets";
export const kFirebaseStorageHandlerName = "firebaseStorage";
export const kFirebaseRealTimeDBHandlerName = "firebaseRealTimeDB";

export enum EntryStatus { 
  Storing = "storing",
  ComputingDimensions = "computingDimensions",
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
    status: types.enumeration<EntryStatus>("EntryStatus", Object.values(EntryStatus))
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
export interface IImageHandlerStoreOptions extends IImageBaseOptions{
  db?: DB;
}
export interface IImageHandlerStoreResult {
  filename?: string;
  contentUrl?: string;
  displayUrl?: string;
  success: boolean;
}
export interface IImageHandler {
  name: string;
  priority: number;
  match: (url: string) => boolean;
  store: (url: string, options?: IImageHandlerStoreOptions) => Promise<IImageHandlerStoreResult>;
}
// map from image url => component id => listener function
export type ImageListenerMap = Record<string, Record<string, () => void>>;

export const ImageMapModel = types
  .model("ImageMap", {
    images: types.map(ImageMapEntry)
  })
  .volatile(self => ({
    handlers: [] as IImageHandler[],
    storingPromises: {} as Record<string, Promise<ImageMapEntryType>>
  }))
  .views(self => ({
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
    }
  }))
  .actions(self => ({
    registerHandler(handler: IImageHandler) {
      self.handlers.push(handler);
      self.handlers.sort((a, b) => {
        return (b.priority || 0) - (a.priority || 0);
      });
    },

    _syncContentUrl(url: string, entry: ImageMapEntryType) {
      if (!entry.contentUrl || (url === entry.contentUrl)) {
        return;
      }

      // See image-map.md "URL Conversion" for a full fleshed out description
      // of this logic.
      const existingEntry = self.images.get(entry.contentUrl);
      if (!existingEntry || existingEntry.status === EntryStatus.Error) {
        if (entry.status === EntryStatus.Ready) {
          // store or update the entry
          self.images.set(entry.contentUrl, getSnapshot(entry));
        }
        else if (entry.status === EntryStatus.ComputingDimensions) {
          // store or update the entry
          self.images.set(entry.contentUrl, getSnapshot(entry));
          // copy the storing promise incase some code calls 
          // getImage(entry.contentUrl)
          self.storingPromises[entry.contentUrl] = self.storingPromises[url];
        }
      }

      if (existingEntry?.status === EntryStatus.ComputingDimensions && 
          (entry.status === EntryStatus.Error || entry.status === EntryStatus.Ready) && 
          self.storingPromises[url] === self.storingPromises[entry.contentUrl]) {
        // If the existingEntry is "managed" by the same promise as the entry
        // we should updated it in some cases.
        // See image-map.md "New Cache entry is in the Error state" and 
        // "New cache entry is in Ready state"
        self.images.set(entry.contentUrl, getSnapshot(entry));
      }
    },
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
    addImage: flow(function* addImage(url: string, storeResult: IImageHandlerStoreResult)
                              : Generator<PromiseLike<any>, ImageMapEntryType, unknown> {

      if (!storeResult.displayUrl) {
        // As far as I can tell it should be an error if the displayUrl
        // is not set. Even when there is an error the displayUrl should be
        // set to the placeholderImage.
        console.error(`addImage called with a storeResult without an displayUrl. ` + 
          `url: ${url}, contentUrl: ${storeResult.contentUrl}, success: ${storeResult.success}`);

        // We have still store the entry but we update it to be errored.
        storeResult.success = false;
      }

      const { success: successfulStore, ...otherProps} = storeResult; 
      const snapshot: ImageMapEntrySnapshot = {
        ...otherProps,
        status: successfulStore ? EntryStatus.ComputingDimensions : EntryStatus.Error
      };

      // Update or add the entry. We do this whether there is an error or not.
      // If there is an error it is still recorded so observers of the entry
      // will see the change
      // Note: originally the contentUrl of the original entry was only updated if it was actually
      // set in the snapshot. This approach complicates things and I don't see a benefit to it.
      self.images.set(url, snapshot);

      const entry = self.images.get(url)!;

      if (entry.status === EntryStatus.Error) {
        // This means the storage operation failed. 

        // We could clear the storingPromise here, but instead we just leave it and
        // rely on getImage to ignore and delete the storingPromise when it sees there is
        // an entry with a status of error.

        // Even if this entry has a contentUrl that is different than its url
        // we do not update the entry at the contentUrl. 
        // See image-map.md "New cache entry is in the Error state"

        // We return so we don't sync and don't try to get the dimensions
        // See image-map.md "Dimensions" for why we don't set the dimensions
        return entry;  
      } 

      self._syncContentUrl(url, entry);

      try {
        // If the getImageDimension image element never loads or errors then we won't get
        // past this line. However I'd hope that the browser will eventually trigger 
        // one of those events.
        // However in most cases addImage is not called until the image has already been
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
        // Leaving displayUrl is less clear
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
        self.addImage(placeholderImage, { displayUrl: placeholderImage, success: true });

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
        return self.addImage(entry.contentUrl!, entry);
      }),

      _getImage: flow(function* (url: string, handler: IImageHandler, options?: IImageBaseOptions)
                       : Generator<PromiseLike<any>, ImageMapEntryType | Promise<ImageMapEntryType>, unknown> {
        const imageEntrySnapshot = (yield handler.store(url, { db: _db, ...options })) as IImageHandlerStoreResult;
        return self.addImage(url, imageEntrySnapshot);
      }),
    };
  })
  .actions(self => ({
    // eslint-disable-next-line require-yield
    getImage: flow(function* (url: string, options?: IImageBaseOptions)
                    : Generator<PromiseLike<any>, ImageMapEntryType | Promise<ImageMapEntryType>, unknown> {
      if (!url) {
        // TODO: how often does this happen, should it be silently ignored like this?
        return clone(self.images.get(placeholderImage)!);
      }

      const imageEntry = self.images.get(url);
      if (imageEntry?.status === EntryStatus.Ready) {
        // This image has been downloaded successfully already
        return imageEntry;
      }

      const existingStoringPromise = self.storingPromises[url];      
      if (existingStoringPromise) {
        if (imageEntry?.status === EntryStatus.Error) {
          // FIXME: maybe we should just get rid of this code?
          // As long as we ignore the existing promise when the status is error
          // it shouldn't hurt to leave it around.
          // We can add functional tests first and then remove the code and make
          // sure they still work
          // The only downside I can think of is memory leaks, but if those are a problem
          // we should clean up the promise when the error happens

          // If the imageEntry has a status of Error.  We clear out the storingPromise.
          delete self.storingPromises[url];

          // If there is a contentUrl because of an error during computing
          // dimensions there could be a storingPromise for the contentUrl that was
          // added by syncContenUrl, to be complete we delete that too.
          if (imageEntry.contentUrl && imageEntry.contentUrl !== url) {
            const contentUrlEntry = self.images.get(imageEntry.contentUrl);
            if (contentUrlEntry?.status === EntryStatus.Error) {
              // delete the promise if it exists
              delete self.storingPromises[imageEntry.contentUrl];
            }
          }
        } else {
          return existingStoringPromise;
        }
      }

      const handler = self.getHandler(url);
      if (!handler) {
        console.warn(`No handler found for ${url}`);
        return clone(self.images.get(placeholderImage)!);
      }

      // If there is an existing entry we'll overwrite it so it's status is
      // storing and the displayUrl is the placeholder. In theory the
      // existingEntry could have a status of Storing, ComputingDimensions, or
      // Error. Because there is no existingStoringPromise the status should
      // really not be Storing or ComputingDimensions.
      if (imageEntry?.status === EntryStatus.Storing || 
          imageEntry?.status === EntryStatus.ComputingDimensions) {
        console.warn(`ImageMap.getImage found an entry with a status ${imageEntry.status} at ${url}`);
      }
      
      self.images.set(url, {status: EntryStatus.Storing, displayUrl: placeholderImage});

      const storingPromise = self._getImage(url, handler, options);

      // keep track of the storingPromise
      self.storingPromises[url] = storingPromise;

      return storingPromise;      
    })
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
    if (db?.stores.user.id) {
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
          return { contentUrl: url, displayUrl: url, success: true  };
      }
    }
    else {
      // For now, return the original image url.
      return { contentUrl: url, displayUrl: url, success: true  };
    }
  }
};

/*
 * localAssetsImagesHandler
 */
export const localAssetsImagesHandler: IImageHandler = {
  name: kLocalAssetsHandlerName,
  priority: 2,

  match(url: string) {
    return url ? url.startsWith("assets/") || url.startsWith("curriculum/") : false;
  },

  async store(url: string) {
                    // convert original curriculum image paths
    const _url = url.replace("assets/curriculum", "curriculum")
                    // convert original drawing tool stamp paths
                    .replace("assets/tools/drawing-tool/stamps",
                             "curriculum/moving-straight-ahead/stamps");
    return { contentUrl: _url, displayUrl: _url, success: true  };
  }
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
const kErrorImageEntrySnapshot: IImageHandlerStoreResult = { 
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
          return kErrorImageEntrySnapshot;
        }
      } catch (error) {
        return kErrorImageEntrySnapshot;
      }
    }
    else {
      return kErrorImageEntrySnapshot;
    }
  }
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
             ? { filename: options?.filename, contentUrl: normalized, displayUrl: blobUrl,
                 success: true }
             // Note: we used to return an empty image entry here. This used to cause
             // problems with some code that would then try to load the original url which
             // might be a ccimg: url.
             // This empty entry seems to also be expected by jxg-image which was for for
             // for falsey displayUrl. It has been updated to also check the status of the
             // entry
             : kErrorImageEntrySnapshot;
    }
    else {
      return kErrorImageEntrySnapshot;
    }
  }
};

export const gImageMap = ImageMapModel.create();
