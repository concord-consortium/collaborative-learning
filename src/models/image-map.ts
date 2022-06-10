import { types, Instance, SnapshotIn, clone, getSnapshot } from "mobx-state-tree";
import {
  getImageDimensions, isPlaceholderImage, storeCorsImage, storeFileImage, storeImage
} from "../utilities/image-utils";
import { DB } from "../lib/db";
import placeholderImage from "../assets/image_placeholder.png";

export const kExternalUrlHandlerName = "externalUrl";
export const kLocalAssetsHandlerName = "localAssets";
export const kFirebaseStorageHandlerName = "firebaseStorage";
export const kFirebaseRealTimeDBHandlerName = "firebaseRealTimeDB";

export const ImageMapEntry = types
  .model("ImageEntry", {
    filename: types.maybe(types.string),
    contentUrl: types.maybe(types.string),
    displayUrl: types.maybe(types.string),
    width: types.maybe(types.number),
    height: types.maybe(types.number)
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
export interface IImageHandler {
  name: string;
  priority: number;
  match: (url: string) => boolean;
  store: (url: string, options?: IImageHandlerStoreOptions) => Promise<ImageMapEntrySnapshot>;
}
// map from image url => component id => listener function
export type ImageListenerMap = Record<string, Record<string, () => void>>;

export const ImageMapModel = types
  .model("ImageMap", {
    images: types.map(ImageMapEntry)
  })
  .volatile(self => ({
    handlers: [] as IImageHandler[],
    listeners: {} as ImageListenerMap
  }))
  .views(self => ({
    hasImage(url: string) {
      return self.images.has(url);
    },
    get imageCount() {
      return self.images.size;
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
    syncContentUrl(url: string, entry: ImageMapEntryType) {
      if (entry.contentUrl && (url !== entry.contentUrl)) {
        // if the url was changed, store or update it under the new url as well
        self.images.set(entry.contentUrl, getSnapshot(entry));
      }
    },

    setDimensions(url: string, width: number, height: number) {
      const entry = self.images.get(url);
      if (entry) {
        entry.width = width;
        entry.height = height;
      }
    },

    registerHandler(handler: IImageHandler) {
      self.handlers.push(handler);
      self.handlers.sort((a, b) => {
        return (b.priority || 0) - (a.priority || 0);
      });
    },

    // listeners are called when a requested url is cached
    registerListener(url: string, id: string, listener: () => void) {
      if (!self.listeners[url]) {
        self.listeners[url] = {};
      }
      self.listeners[url][id] = listener;
      // return disposer function
      return () => delete self.listeners[url][id];
    }
  }))
  .actions(self => ({
    async addImage(url: string, snapshot: ImageMapEntrySnapshot): Promise<ImageMapEntryType> {
      let entry: ImageMapEntryType | undefined;

      // update existing entry
      if (self.images.has(url)) {
        entry = self.images.get(url);
        if (entry && snapshot.contentUrl) {
          entry.contentUrl = snapshot.contentUrl;
        }
        if (entry && snapshot.displayUrl) {
          entry.displayUrl = snapshot.displayUrl;
        }
      }
      // create new entry
      else {
        entry = ImageMapEntry.create(snapshot);
        self.images.set(url, entry);
        // notify any listeners that the url is now available
        if (self.listeners[url]) {
          for (const id in self.listeners[url]) {
            self.listeners[url][id]();
          }
        }
      }
      self.syncContentUrl(url, entry!);

      // If the getImageDimension image element never loads then we won't get
      // past this line. 
      // However the entry has already been added to the map, so there will be
      // a dimensionless entry in this case.
      // Also in most cases addImage is not called until the image has already been
      // downloaded and displayUrl is actually a blob url.
      // So it should be unlikely in these cases that getImageDimensions will fail.
      const dimensions = await getImageDimensions(entry && entry.displayUrl || url);
      const imageEntry = self.images.get(url);
      if (!imageEntry) {
        // This should really not happen, we just added an image entry above
        // and there isn't a way to remove entries from the map
        /* istanbul ignore next */
        throw `missing image entry in cache for ${url}`;
      }
      self.setDimensions(url, dimensions.width, dimensions.height);
      // If this addImage is called more than once there could be multiple
      // of these promises running at once. And the last one to finish will 
      // clobber the imageEntry.contentUrl entry that was there before.
      // The last one to finish might not be the right one if there are multiple.
      self.syncContentUrl(url, imageEntry);
      return imageEntry;
    }
  }))
  .actions(self => {
    let _db: DB;

    return {
      afterCreate() {
        // placeholder doesn't have contentUrl
        self.addImage(placeholderImage, { displayUrl: placeholderImage });

        self.registerHandler(firebaseRealTimeDBImagesHandler);
        self.registerHandler(firebaseStorageImagesHandler);
        self.registerHandler(localAssetsImagesHandler);
        self.registerHandler(externalUrlImagesHandler);
      },

      initialize(db: DB) {
        _db = db;
      },

      // General Note: Typically actions should not be async like this. An async action will 
      // run outside normal action path so MST can't record its changes to the model.
      // If it tries to modify the model directly MST will raise an error. In the cases
      // below other actions are always called to mae modifications so this is safe.
      async addFileImage(file: File): Promise<ImageMapEntryType> {
        const simpleImage = await storeFileImage(_db, file);
        const { normalized } = parseFauxFirebaseRTDBUrl(simpleImage.imageUrl);
        const entry: ImageMapEntrySnapshot = {
                filename: file.name,
                contentUrl: normalized,
                displayUrl: simpleImage.imageData
              };
        return self.addImage(entry.contentUrl!, entry);
      },

      async getImage(url: string, options?: IImageBaseOptions): Promise<ImageMapEntryType> {
        if (!url) {
          return clone(self.images.get(placeholderImage)!);
        }

        const imageEntry = self.images.get(url);
        if (imageEntry) {
          // This might or might not have dimensions yet
          return imageEntry;
        }

        const handler = self.getHandler(url);
        if (handler) {
          const imageEntrySnapshot = await handler.store(url, { db: _db, ...options });
          return self.addImage(url, imageEntrySnapshot);
        }
        else {
          return clone(self.images.get(placeholderImage)!);
        }
      }

    };
  });
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

  async store(url: string, options?: IImageHandlerStoreOptions) {
    const { db } = options || {};
    // upload images from external urls to our own firebase if possible
    // this may fail depending on CORS settings on target image.
    // After the data of the image is uploaded to firebase is it is not
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
          return { contentUrl: url, displayUrl: url };
        }
        else {
          const { normalized } = parseFauxFirebaseRTDBUrl(simpleImage.imageUrl);
          return { contentUrl: normalized, displayUrl: simpleImage.imageData };
        }
      } catch (error) {
          // If the silent upload has failed, do we retain the full url or
          // encourage the user to download a copy and re-upload?
          // For now, return the original image url.
          return { contentUrl: url, displayUrl: url };
      }
    }
    else {
      // For now, return the original image url.
      return { contentUrl: url, displayUrl: url };
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
    return { contentUrl: _url, displayUrl: _url };
  }
};

/*
 * firebaseStorageImagesHandler
 */
const kFirebaseStorageUrlPrefix = "https://firebasestorage.googleapis.com";

export const firebaseStorageImagesHandler: IImageHandler = {
  name: kFirebaseStorageHandlerName,
  priority: 3,

  match(url: string) {
    return url.startsWith(kFirebaseStorageUrlPrefix) ||
                          // original firebase storage path reference
                          /^\/.+\/portals\/.+$/.test(url);
  },

  async store(url: string, options?: IImageHandlerStoreOptions) {
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
          return { contentUrl: normalized, displayUrl: simpleImage.imageData };
        }
        else {
          return { contentUrl: placeholderImage, displayUrl: placeholderImage };
        }
      } catch (error) {
        return { contentUrl: placeholderImage, displayUrl: placeholderImage };
      }
    }
    else {
      return { contentUrl: placeholderImage, displayUrl: placeholderImage };
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

  async store(url: string, options?: IImageHandlerStoreOptions) {
    const { db } = options || {};
    const { path, classHash, imageKey, normalized } = parseFauxFirebaseRTDBUrl(url);

    if (db && path && normalized) {
      // In theory we could direct all firebase image requests to the cloud function,
      // but only cross-class supports require the use of the cloud function.
      const blobPromise = classHash !== db.stores.user.classHash
                            ? db.getCloudImageBlob(normalized)
                            : db.getImageBlob(imageKey);
      const blobUrl = await blobPromise;
      return blobUrl
             ? { filename: options?.filename, contentUrl: normalized, displayUrl: blobUrl }
             : {};
    }
    else {
      return {};
    }
  }
};

export const gImageMap = ImageMapModel.create();
