import { types, Instance, SnapshotIn, clone } from "mobx-state-tree";
import { getImageDimensions, storeCorsImage, storeFileImage, storeImage } from "../utilities/image-utils";
import { DB } from "../lib/db";
import placeholderImage from "../assets/image_placeholder.png";

export const kExternalUrlHandlerName = "externalUrl";
export const kLocalAssetsHandlerName = "localAssets";
export const kFirebaseStorageHandlerName = "firebaseStorage";
export const kFirebaseRealTimeDBHandlerName = "firebaseRealTimeDB";

export const ImageMapEntry = types
  .model("ImageEntry", {
    contentUrl: types.maybe(types.string),
    displayUrl: types.maybe(types.string),
    width: types.maybe(types.number),
    height: types.maybe(types.number)
  });
export type ImageMapEntryType = Instance<typeof ImageMapEntry>;
export type ImageMapEntrySnapshot = SnapshotIn<typeof ImageMapEntry>;

export interface IImageHandler {
  name: string;
  priority: number;
  match: (url: string) => boolean;
  store: (url: string, db?: DB, userId?: string) => Promise<ImageMapEntrySnapshot>;
}

export const ImageMapModel = types
  .model("ImageMap", {
    images: types.map(ImageMapEntry)
  })
  .volatile(self => ({
    handlers: [] as IImageHandler[]
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
    isDataImageUrl(url: string) {
      return /data:image\//.test(url);
    },
    isPlaceholder(url: string) {
      return url === placeholderImage;
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
        }
        self.syncContentUrl(url, entry!);

        getImageDimensions(entry && entry.displayUrl || url)
          .then(dimensions => {
            const _entry = self.images.get(url);
            if (_entry) {
              self.setDimensions(url, dimensions.width, dimensions.height);
              self.syncContentUrl(url, _entry);
              resolve(self.images.get(url));
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
    let _userId: string;

    return {
      afterCreate() {
        // placeholder doesn't have contentUrl
        self.addImage(placeholderImage, { displayUrl: placeholderImage });

        self.registerHandler(firebaseRealTimeDBImagesHandler);
        self.registerHandler(firebaseStorageImagesHandler);
        self.registerHandler(localAssetsImagesHandler);
        self.registerHandler(externalUrlImagesHandler);
      },

      initialize(db: DB, userId: string) {
        _db = db;
        _userId = userId;
      },

      addFileImage(file: File): Promise<ImageMapEntryType> {
        return new Promise((resolve, reject) => {
          storeFileImage(_db, _userId, file)
            .then(simpleImage => {
              const { normalized } = parseFauxFirebaseRTDBUrl(simpleImage.imageUrl);
              const entry: ImageMapEntrySnapshot = {
                      contentUrl: normalized,
                      displayUrl: simpleImage.imageData
                    };
              resolve(self.addImage(entry.contentUrl!, entry));
            });
        });
      },

      getImage(url: string): Promise<ImageMapEntryType> {
        return new Promise((resolve, reject) => {
          if (!url) {
            resolve(clone(self.images.get(placeholderImage)!));
          }

          if (self.images.has(url)) {
            return resolve(self.images.get(url));
          }

          const handler = self.getHandler(url);
          if (handler) {
            const promise = handler.store(url, _db, _userId);
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

  store(url: string, db?: DB, userId?: string) {
    // upload images from external urls to our own firebase if possible
    // this may fail depending on CORS settings on target image.
    return new Promise((resolve, reject) => {
      if (db && userId) {
        storeImage(db, userId, url)
          .then(simpleImage => {
            if (simpleImage.imageUrl === placeholderImage) {
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
            resolve({});
          });
      }
      else {
        // For now, return the original image url.
        resolve({});
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

  store(url: string, db?: DB, userId?: string) {
    return new Promise((resolve, reject) => {
      // All images from firebase storage must be migrated to realtime database
      const isStorageUrl = url.startsWith(kFirebaseStorageUrlPrefix);
      const storageUrl = url.startsWith(kFirebaseStorageUrlPrefix) ? url : undefined;
      const storagePath = !isStorageUrl ? url : undefined;
      // Pass in the imagePath as the second argument to get the ref to firebase storage by url
      // This is needed if an image of the same name has been uploaded in two different components,
      // since each public URL becomes invalid and a new url generated on upload
      if (db && userId) {
        db.firebase.getPublicUrlFromStore(storagePath, storageUrl)
          .then(newUrl => {
            if (newUrl) {
              storeCorsImage(db, userId, newUrl)
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
function parseFauxFirebaseRTDBUrl(url: string) {
  const path = extractPathFromFirebaseRTDBFauxUrl(url) || undefined;
  const normalized = path && createFirebaseRTDBFauxUrl(path);
  return { path, normalized };
}

export const firebaseRealTimeDBImagesHandler: IImageHandler = {
  name: kFirebaseRealTimeDBHandlerName,
  priority: 4,

  match(url: string) {
    return url.startsWith(kFirebaseRTDBFauxUrlPrefix) ||
          (url.startsWith(`${kCCImageScheme}://`) && (url.indexOf("concord.org") < 0));
  },

  store(url: string, db?: DB) {
    return new Promise((resolve, reject) => {
      const { path, normalized } = parseFauxFirebaseRTDBUrl(url);

      if (db && path && normalized) {
        db.getImageBlob(path)
          .then(blobUrl => {
            resolve({ contentUrl: normalized, displayUrl: blobUrl });
          });
      }
      else {
        resolve({});
      }
    });
  }
};

export const gImageMap = ImageMapModel.create();
