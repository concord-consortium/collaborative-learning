import { types, Instance, SnapshotIn, clone } from "mobx-state-tree";
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
  context?: IImageContext;
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
        // if the url was changed, store it under the new url as well
        self.images.set(entry.contentUrl, clone(entry));
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
    addImage(url: string, snapshot: ImageMapEntrySnapshot): Promise<ImageMapEntryType> {
      return new Promise((resolve, reject) => {
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

        getImageDimensions(entry && entry.displayUrl || url)
          .then(dimensions => {
            const imageEntry = self.images.get(url);
            if (imageEntry) {
              self.setDimensions(url, dimensions.width, dimensions.height);
              self.syncContentUrl(url, imageEntry);
              resolve(imageEntry);
            }
          });
      });
    }
  }))
  .actions(self => ({
    addPromise(url: string, promise: Promise<ImageMapEntrySnapshot>): Promise<ImageMapEntryType> {
      return new Promise((resolve, reject) => {
        promise.then(snapshot => {
          resolve(self.addImage(url, snapshot));
        });
      });
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

      addFileImage(file: File): Promise<ImageMapEntryType> {
        return new Promise((resolve, reject) => {
          storeFileImage(_db, file)
            .then(simpleImage => {
              const { normalized } = parseFauxFirebaseRTDBUrl(simpleImage.imageUrl);
              const entry: ImageMapEntrySnapshot = {
                      filename: file.name,
                      contentUrl: normalized,
                      displayUrl: simpleImage.imageData
                    };
              resolve(self.addImage(entry.contentUrl!, entry));
            });
        });
      },

      getImage(url: string, options?: IImageBaseOptions): Promise<ImageMapEntryType> {
        return new Promise((resolve, reject) => {
          if (!url) {
            resolve(clone(self.images.get(placeholderImage)!));
          }

          const imageEntry = self.images.get(url);
          if (imageEntry) {
            return resolve(imageEntry);
          }

          const handler = self.getHandler(url);
          if (handler) {
            const promise = handler.store(url, { db: _db, ...options });
            resolve(self.addPromise(url, promise));
          }
          else {
            resolve(clone(self.images.get(placeholderImage)!));
          }
        });
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

  store(url: string, options?: IImageHandlerStoreOptions) {
    const { db } = options || {};
    // upload images from external urls to our own firebase if possible
    // this may fail depending on CORS settings on target image.
    return new Promise((resolve, reject) => {
      if (db?.stores.user.id) {
        storeImage(db, url)
          .then(simpleImage => {
            if (isPlaceholderImage(simpleImage.imageUrl)) {
              // conversion errors are resolved to placeholder image
              // this generally occurs due to a CORS error, in which
              // case we just use the original url.
              resolve({ contentUrl: url, displayUrl: url });
            }
            else {
              const { normalized } = parseFauxFirebaseRTDBUrl(simpleImage.imageUrl);
              resolve({ contentUrl: normalized, displayUrl: simpleImage.imageData });
            }
          })
          .catch(() => {
            // If the silent upload has failed, do we retain the full url or
            // encourage the user to download a copy and re-upload?
            // For now, return the original image url.
            resolve({ contentUrl: url, displayUrl: url });
          });
      }
      else {
        // For now, return the original image url.
        resolve({ contentUrl: url, displayUrl: url });
      }
    });
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

  store(url: string) {
                    // convert original curriculum image paths
    const _url = url.replace("assets/curriculum", "curriculum")
                    // convert original drawing tool stamp paths
                    .replace("assets/tools/drawing-tool/stamps",
                             "curriculum/moving-straight-ahead/stamps");
    return Promise.resolve({ contentUrl: _url, displayUrl: _url });
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

  store(url: string, options?: IImageHandlerStoreOptions) {
    return new Promise((resolve, reject) => {
      const { db } = options || {};
      // All images from firebase storage must be migrated to realtime database
      const isStorageUrl = url.startsWith(kFirebaseStorageUrlPrefix);
      const storageUrl = url.startsWith(kFirebaseStorageUrlPrefix) ? url : undefined;
      const storagePath = !isStorageUrl ? url : undefined;
      // Pass in the imagePath as the second argument to get the ref to firebase storage by url
      // This is needed if an image of the same name has been uploaded in two different components,
      // since each public URL becomes invalid and a new url generated on upload
      if (db?.stores.user.id) {
        db.firebase.getPublicUrlFromStore(storagePath, storageUrl)
          .then(newUrl => {
            if (newUrl) {
              storeCorsImage(db, newUrl)
                .then(simpleImage => {
                  // Image has been retrieved from Storage, now we can safely remove the old image
                  // TODO: remove old images
                  const { normalized } = parseFauxFirebaseRTDBUrl(simpleImage.imageUrl);
                  resolve({ contentUrl: normalized, displayUrl: simpleImage.imageData });
                });
            }
            else {
              resolve({ contentUrl: placeholderImage, displayUrl: placeholderImage });
            }
          })
          .catch(() => {
            resolve({ contentUrl: placeholderImage, displayUrl: placeholderImage });
          });
      }
      else {
        resolve({ contentUrl: placeholderImage, displayUrl: placeholderImage });
      }
    });
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
function extractClassHashFromPath(path: string) {
  const match = /([^/]+)\/[^/]+/.exec(path);
  return match && match[1] || undefined;
}
function parseFauxFirebaseRTDBUrl(url: string) {
  const path = extractPathFromFirebaseRTDBFauxUrl(url) || undefined;
  const classHash = path && extractClassHashFromPath(path);
  const normalized = path && createFirebaseRTDBFauxUrl(path);
  return { path, classHash, normalized };
}

export const firebaseRealTimeDBImagesHandler: IImageHandler = {
  name: kFirebaseRealTimeDBHandlerName,
  priority: 4,

  match(url: string) {
    return url.startsWith(kFirebaseRTDBFauxUrlPrefix) ||
          (url.startsWith(`${kCCImageScheme}://`) && (url.indexOf("concord.org") < 0));
  },

  store(url: string, options?: IImageHandlerStoreOptions) {
    return new Promise((resolve, reject) => {
      const { context, db } = options || {};
      const { path, classHash, normalized } = parseFauxFirebaseRTDBUrl(url);

      if (db && path && normalized) {
        // In theory we could direct all firebase image requests to the cloud function,
        // but only cross-class supports require the use of the cloud function.
        const blobPromise = classHash !== db.stores.user.classHash
                              ? db.getCloudImageBlob(path, context?.type, context?.key)
                              : db.getImageBlob(path);
        blobPromise.then(blobUrl => {
          resolve(blobUrl
                    ? { filename: options?.filename, contentUrl: normalized, displayUrl: blobUrl }
                    : {});
        });
      }
      else {
        resolve({});
      }
    });
  }
};

export const gImageMap = ImageMapModel.create();
