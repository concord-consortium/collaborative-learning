import { externalUrlImagesHandler, localAssetsImagesHandler,
        firebaseRealTimeDBImagesHandler, firebaseStorageImagesHandler,
        IImageHandler, ImageMapEntry, ImageMapModel, ImageMapModelType, 
        EntryStatus, IImageHandlerStoreOptions, 
        IImageHandlerStoreResult } from "./image-map";
import { parseFirebaseImageUrl } from "../../functions/src/shared-utils";
import { DB } from "../lib/db";
import * as ImageUtils from "../utilities/image-utils";
import placeholderImage from "../assets/image_placeholder.png";
import { runInAction, when } from "mobx";
import { applySnapshot, destroy, protect, unprotect } from "mobx-state-tree";

let sImageMap: ImageMapModelType;

function unsafeUpdate(func: () => void) {
  runInAction(() => {
    unprotect(sImageMap);
    func();
    protect(sImageMap);
  });
}

describe("ImageMap", () => {
  const kLocalImageUrl = "assets/logo_tw.png";
  const kHttpImageUrl = "http://icon.cat/img/icon_loop.png";
  const kHttpsImageUrl = "https://icon.cat/img/icon_loop.png";
  const kFBStorageUrl = "https://firebasestorage.googleapis.com/path/to/image";
  const kFBStorageRef = "/dev/w8podRScLDbiu5zK3bE6323PY6G3/portals/localhost/coin-background.png";
  const kCCImgOriginalUrl = "ccimg://imagePath";
  const kCCImgFBRTDBUrl = "ccimg://fbrtdb.concord.org/imagePath";
  // starting with CLUE 2.1.3, image paths include the class hash
  const kCCImgClassFBRTDBUrl = "ccimg://fbrtdb.concord.org/classHash/imagePath";
  const kCCImgS3Url = "ccimg://s3.concord.org/path/to/image";
  const kBlobUrl = "blob://some-blob-path";
  const kDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAABG2lUWH";
  const kInputs = [
          kLocalImageUrl, kHttpImageUrl, kHttpsImageUrl, kFBStorageUrl, kFBStorageRef,
          kCCImgOriginalUrl, kCCImgFBRTDBUrl, kCCImgClassFBRTDBUrl, kDataUri, kCCImgS3Url, kBlobUrl];
  const kHandlers = [
          localAssetsImagesHandler, externalUrlImagesHandler, externalUrlImagesHandler,
          firebaseStorageImagesHandler, firebaseStorageImagesHandler,
          firebaseRealTimeDBImagesHandler, firebaseRealTimeDBImagesHandler, firebaseRealTimeDBImagesHandler,
          externalUrlImagesHandler, undefined, undefined ];

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(ImageUtils, "getImageDimensions")
        .mockImplementation(() =>
          Promise.resolve({ src: placeholderImage, width: 200, height: 150 }));
    if (sImageMap) { destroy(sImageMap); }
    sImageMap = ImageMapModel.create();
  });
          
  function createMockDB(overrides?: Record<string, any>) {
    return {
      stores: { user: { id: "user", classHash: "classHash" }},
      firebase: { getPublicUrlFromStore: (path?: string, url?: string) => Promise.resolve(kFBStorageUrl) },
      getCloudImageBlob: jest.fn(() => Promise.resolve(kBlobUrl)),
      getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl)),
      ...overrides
    } as any as DB;
  }

  function expectToMatch(handler: IImageHandler, matches: string[]) {
    expect(kInputs.every((input, index) => {
      const didMatch = handler.match(input);
      const shouldMatch = matches.indexOf(input) >= 0;
      if (didMatch !== shouldMatch) {
        console.warn(`handler: ${handler.name}, input: ${input}, match: ${didMatch}, should: ${shouldMatch}`);
      }
      expect(didMatch).toBe(shouldMatch);
      return didMatch === shouldMatch;
    })).toBe(true);
  }

  it("test basic accessors", () => {
    expect(sImageMap.isExternalUrl(placeholderImage)).toBe(false);
    expect(sImageMap.isExternalUrl(kLocalImageUrl)).toBe(false);
    expect(sImageMap.isExternalUrl(kHttpImageUrl)).toBe(true);
    expect(sImageMap.isExternalUrl(kHttpsImageUrl)).toBe(true);
    expect(sImageMap.isExternalUrl(kFBStorageUrl)).toBe(false);
    expect(sImageMap.isExternalUrl(kDataUri)).toBe(true);

    expect(sImageMap.isPlaceholder(placeholderImage)).toBe(true);
    expect(sImageMap.isPlaceholder(kLocalImageUrl)).toBe(false);
    expect(sImageMap.isPlaceholder(kHttpImageUrl)).toBe(false);
    expect(sImageMap.isPlaceholder(kHttpsImageUrl)).toBe(false);
    expect(sImageMap.isPlaceholder(kFBStorageUrl)).toBe(false);
    expect(sImageMap.isPlaceholder(kDataUri)).toBe(false);
  });

  it("test localAssetsImagesHandler", () => {
    expectToMatch(localAssetsImagesHandler, [kLocalImageUrl]);
    return localAssetsImagesHandler.store(kLocalImageUrl)
            .then(storeResult => {
              expect(storeResult.contentUrl).toBe(kLocalImageUrl);
              expect(storeResult.displayUrl).toBe(kLocalImageUrl);
            });
  });

  it("test externalUrlImagesHandler", () => {
    expectToMatch(externalUrlImagesHandler, [kHttpImageUrl, kHttpsImageUrl, kFBStorageUrl, kDataUri]);

    let p1: any;
    let p2: any;

    {
      const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                            .mockImplementation(() =>
                              Promise.resolve({ imageUrl: kCCImgFBRTDBUrl, imageData: kBlobUrl}));
      p1 = externalUrlImagesHandler.store(kHttpsImageUrl, { db: createMockDB() })
        .then(storeResult => {
          expect(storeSpy).toHaveBeenCalled();
          expect(storeResult.contentUrl &&
                  firebaseRealTimeDBImagesHandler.match(storeResult.contentUrl)).toBe(true);
          expect(storeResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                            .mockImplementation(() => Promise.reject(new Error("Loading error")));
      p2 = externalUrlImagesHandler.store(kHttpsImageUrl, { db: createMockDB() })
        .then(storeResult => {
          expect(storeSpy).toHaveBeenCalled();
          expect(storeResult.contentUrl).toBe(kHttpsImageUrl);
          expect(storeResult.displayUrl).toBe(kHttpsImageUrl);
        });
    }
    return Promise.all([p1, p2]);
  });

  it("test externalUrlImagesHandler placeholder conversion", () => {
    let p1: any;
    let p2: any;

    {
      const kHttpsImage2 = kHttpsImageUrl + "2";
      const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                            .mockImplementation(() =>
                              Promise.resolve({ imageUrl: placeholderImage, imageData: placeholderImage}));
      p1 = externalUrlImagesHandler.store(kHttpsImage2, { db: createMockDB() })
        .then(storeResult => {
          expect(storeSpy).toHaveBeenCalled();
          expect(storeResult.contentUrl).toBe(kHttpsImage2);
          expect(storeResult.displayUrl).toBe(kHttpsImage2);
        });
    }
    {
      const kHttpsImage3 = kHttpsImageUrl + "3";
      const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                            .mockImplementation(() =>
                              Promise.resolve({ imageUrl: placeholderImage, imageData: placeholderImage}));
      p2 = externalUrlImagesHandler.store(kHttpsImage3, { db: createMockDB({ stores: { user: { id: "" }} }) })
        .then(storeResult => {
          expect(storeSpy).toHaveBeenCalled();
          expect(storeResult.contentUrl).toBe(kHttpsImage3);
          expect(storeResult.displayUrl).toBe(kHttpsImage3);
        });
    }
    return Promise.all([p1, p2]);
  });

  it("test firebaseStorageImagesHandler on firebase storage URL", () => {
    expectToMatch(firebaseStorageImagesHandler, [kFBStorageUrl, kFBStorageRef]);

    const storeSpy = jest.spyOn(ImageUtils, "storeCorsImage")
                          .mockImplementation(() => Promise.resolve({ imageUrl: kCCImgFBRTDBUrl, imageData: kBlobUrl}));
    return firebaseStorageImagesHandler.store(kFBStorageUrl, { db: createMockDB() })
      .then(storeResult => {
        expect(storeSpy).toHaveBeenCalled();
        expect(storeResult.contentUrl &&
                firebaseRealTimeDBImagesHandler.match(storeResult.contentUrl)).toBe(true);
        expect(storeResult.displayUrl).toMatch(/^blob:/);
      });
  });

  it("test firebaseStorageImagesHandler on firebase storage reference", () => {
    const storeSpy = jest.spyOn(ImageUtils, "storeCorsImage")
                          .mockImplementation(() => Promise.resolve({ imageUrl: kCCImgFBRTDBUrl, imageData: kBlobUrl}));
    return firebaseStorageImagesHandler.store(kFBStorageRef, { db: createMockDB() })
      .then(storeResult => {
        expect(storeSpy).toHaveBeenCalled();
        expect(storeResult.contentUrl &&
                firebaseRealTimeDBImagesHandler.match(storeResult.contentUrl)).toBe(true);
        expect(storeResult.displayUrl).toMatch(/^blob:/);
      });
  });

  it("test firebaseStorageImagesHandler error handling", () => {
    const mockDB = createMockDB({
            firebase: { getPublicUrlFromStore: (path?: string, url?: string) => Promise.resolve(undefined) }
          });
    // const storeSpy = jest.spyOn(ImageUtils, "storeImage")
    //                       .mockImplementation(() => Promise.resolve({ imageUrl: kCCImgFBRTDB, imageData: kBlobUrl}));
    firebaseStorageImagesHandler.store(kCCImgFBRTDBUrl, { db: mockDB })
      .then(storeResult => {
        // expect(storeSpy).not.toHaveBeenCalled();
        expect(storeResult.contentUrl).toBeUndefined();
        expect(storeResult.displayUrl).toBe(placeholderImage);
        expect(storeResult.success).toBe(false);
      });

    // handle invalid user Id
    mockDB.stores.user.id = "";
    firebaseStorageImagesHandler.store(kCCImgFBRTDBUrl, { db: mockDB })
      .then(storeResult => {
        // expect(storeSpy).not.toHaveBeenCalled();
        expect(storeResult.contentUrl).toBeUndefined();
        expect(storeResult.displayUrl).toBe(placeholderImage);
        expect(storeResult.success).toBe(false);
      });
  });

  it("test firebaseStorageImagesHandler error handling", () => {
    const mockDB = createMockDB({
            firebase: { getPublicUrlFromStore: (path?: string, url?: string) =>
                                                  Promise.reject(new Error("Conversion error")) }
          });
    // const storeSpy = jest.spyOn(ImageUtils, "storeImage")
    //                       .mockImplementation(() => Promise.reject(new Error("Conversion error")));
    return firebaseStorageImagesHandler.store(kCCImgFBRTDBUrl, { db: mockDB })
      .then(storeResult => {
        // expect(storeSpy).not.toHaveBeenCalled();
        expect(storeResult.contentUrl).toBeUndefined();
        expect(storeResult.displayUrl).toBe(placeholderImage);
      });
  });

  it("test firebaseStorageImagesHandler error handling", () => {
    const storeSpy = jest.spyOn(ImageUtils, "storeCorsImage")
                          .mockImplementation(() => Promise.reject(new Error("Conversion error")));
    return firebaseStorageImagesHandler.store(kCCImgFBRTDBUrl, { db: createMockDB() })
      .then(storeResult => {
        expect(storeSpy).toHaveBeenCalled();
        expect(storeResult.contentUrl).toBeUndefined();
        expect(storeResult.displayUrl).toBe(placeholderImage);
        expect(storeResult.success).toBe(false);
      });
  });

  it("test firebaseRealTimeDBImagesHandler", () => {
    const { imageKey } = parseFirebaseImageUrl(kCCImgClassFBRTDBUrl);
    expectToMatch(firebaseRealTimeDBImagesHandler, [kCCImgOriginalUrl, kCCImgFBRTDBUrl, kCCImgClassFBRTDBUrl]);
    let p1: any;
    let p2: any;
    let p3: any;
    let p4: any;
    {
      const mockDB = createMockDB();
      p1 = firebaseRealTimeDBImagesHandler.store(kCCImgOriginalUrl, { db: mockDB })
        .then(storeResult => {
          // url doesn't include classHash, so we use the firebase function
          expect(mockDB.getCloudImageBlob).toHaveBeenCalledWith(kCCImgFBRTDBUrl);
          expect(storeResult.contentUrl).toBe(kCCImgFBRTDBUrl);
          expect(storeResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      const mockDB = createMockDB();
      p2 = firebaseRealTimeDBImagesHandler.store(kCCImgFBRTDBUrl, { db: mockDB })
        .then(storeResult => {
          // url doesn't include classHash, so we use the firebase function
          expect(mockDB.getCloudImageBlob).toHaveBeenCalledWith(kCCImgFBRTDBUrl);
          expect(storeResult.contentUrl).toBe(kCCImgFBRTDBUrl);
          expect(storeResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      const mockDB = createMockDB();
      p3 = firebaseRealTimeDBImagesHandler.store(kCCImgClassFBRTDBUrl, { db: mockDB })
        .then(storeResult => {
          // url does include classHash, so we can retrieve it locally
          expect(mockDB.getImageBlob).toHaveBeenCalledWith(imageKey);
          expect(storeResult.contentUrl).toBe(kCCImgClassFBRTDBUrl);
          expect(storeResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      p4 = firebaseRealTimeDBImagesHandler.store("", { db: createMockDB() })
        .then(storeResult => {
          expect(storeResult.contentUrl).toBeUndefined();
          expect(storeResult.displayUrl).toBe(placeholderImage);
          expect(storeResult.success).toBe(false);
        });
    }
    return Promise.all([p1, p2, p3, p4]);
  });

  it("can be initialized", () => {
    sImageMap.initialize(createMockDB());

    expect(sImageMap.handlers[0].name).toBe("firebaseRealTimeDB");
    expect(sImageMap.handlers[1].name).toBe("firebaseStorage");
    expect(sImageMap.handlers[2].name).toBe("localAssets");
  });

  it("dispatches URLs to appropriate handlers", () => {
    expect(kInputs.every((url, index) => {
      const expected = kHandlers[index];
      const handler = sImageMap.getHandler(url);
      expect(handler && handler.name).toBe(expected && expected.name);
      return (handler && handler.name) === (expected && expected.name);
    }));
  });

  describe("getImage", () => {
    it("can handle falsy urls", () => {
      expect(sImageMap.getCachedImage("")).toBeUndefined();
      return sImageMap.getImage("")
              .then(image => {
                expect(image.displayUrl).toBe(placeholderImage);
                expect(image.width).toBe(200);
                expect(image.height).toBe(150);
              });
    });
  
    it("can retrieve placeholder image from cache", () => {
      expect(sImageMap.hasImage(placeholderImage));
      expect(sImageMap.getCachedImage(placeholderImage)).toEqual({
        displayUrl: placeholderImage,
        width: 200,
        height: 150,
        status: EntryStatus.Ready
      });
      return sImageMap.getImage(placeholderImage)
              .then(image => {
                expect(image.displayUrl).toBe(placeholderImage);
                expect(image.width).toBe(200);
                expect(image.height).toBe(150);
              });
    });
    
    it("can handle duplicate renders when image map is slow to compute the dimensions", async () => {
      // Expose the image dimensions resolve function so we can call it when we want to
      let imageDimensionResolve: (entrySnapshot: ImageUtils.IImageDimensions) => void;
      const imageDimensionPromise = 
        new Promise<ImageUtils.IImageDimensions>((resolve) => imageDimensionResolve = resolve);    
      const dimSpy = jest.spyOn(ImageUtils, "getImageDimensions")
                          .mockImplementation(() => imageDimensionPromise);
      
      expect.assertions(10);
  
      // After this first call we should expect that the getImage promise will not be
      // resolved until we call imageDimensionResolve
      const firstGetImagePromise = sImageMap.getImage(kLocalImageUrl);
      const secondGetImagePromise = sImageMap.getImage(kLocalImageUrl);
  
      let firstGetImagePromiseResolved = false;
      let secondGetImagePromiseResolved = false;
      firstGetImagePromise.then(() => firstGetImagePromiseResolved = true);
      secondGetImagePromise.then(() => secondGetImagePromiseResolved = true);
  
      // Wait for there to be a cached entry for this url using MobX's wait
      // This will happen after the image is stored, but before the dimensions
      // are requested
      await when(() => !!sImageMap.getCachedImage(kLocalImageUrl));
      
      const imageEntry = sImageMap.getCachedImage(kLocalImageUrl);
      expect(imageEntry?.status).toBe(EntryStatus.ComputingDimensions);
  
      expect(dimSpy).toHaveBeenCalled();
      // We wait for 20ms just to give the javascript engine time to resolve
      // the promises. 
      // Just because the entry was created doesn't mean that the javascript
      // engine had enough time to run the promises (if it was going to 
      // do so).  It depends if the observer for the `when` is run before 
      // the `then` attached to the promises above.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(firstGetImagePromiseResolved).toBe(false);
      expect(secondGetImagePromiseResolved).toBe(false);
  
      imageDimensionResolve!({ src: placeholderImage, width: 200, height: 150 });
  
      const image = await firstGetImagePromise;
      expect(image.contentUrl).toBe(kLocalImageUrl);
      expect(image.displayUrl).toBe(kLocalImageUrl);
      expect(image.width).toBe(200);
      expect(image.height).toBe(150);
      expect(image.status).toBe(EntryStatus.Ready);
  
      const image2 = await secondGetImagePromise;
      expect(image2).toBe(image);
    });

    it("returns the placeholder for unmatched images", () => {
      const consoleSpy = jest.spyOn(global.console, "warn").mockImplementation();
      return sImageMap.getImage("foo")
              .then(image => {
                expect(image.displayUrl).toBe(placeholderImage);
                expect(consoleSpy).toBeCalled();
              });
    });

    it("handles when a previous getImage failed due to a getImageDimensions error", async () => {
      expect.assertions(3);

      // We reset the mocks because when the ImageMap is created it will request the 
      // dimensions of the placeholder image
      jest.resetAllMocks();
      jest.spyOn(ImageUtils, "getImageDimensions").mockImplementation(() =>
        Promise.reject(new Error("mock error"))
      );

      const returnedEntry = await sImageMap.getImage(kLocalImageUrl);
      expect(returnedEntry?.status).toBe(EntryStatus.Error);

      // A second call should try again and succeed   
      jest.spyOn(ImageUtils, "getImageDimensions").mockImplementation(() =>
        Promise.resolve({ src: placeholderImage, width: 200, height: 150 })
      );
      const returnedEntry2 = await sImageMap.getImage(kLocalImageUrl);
      expect(returnedEntry2?.status).toBe(EntryStatus.Ready);
      // The entry should be updated not re-created
      expect(returnedEntry2).toBe(returnedEntry);
    });

    it("handles when a previous getImage that converts the url failed due to a getImageDimensions error", async () => {
      expect.assertions(6);

      // We reset the mocks because when the ImageMap is created it will request the 
      // dimensions of the placeholder image
      jest.resetAllMocks();
      jest.spyOn(ImageUtils, "getImageDimensions").mockImplementation(() =>
        Promise.reject(new Error("mock error"))
      );

      const mockHandler: any = {
        async store(url: string, options?: IImageHandlerStoreOptions): Promise<IImageHandlerStoreResult> {
          return {
            contentUrl: "convertedUrl", 
            displayUrl: "convertedUrl", 
            success: true};
        }
      };
      jest.spyOn(sImageMap, "getHandler").mockImplementation((url: string) => mockHandler);

      const returnedEntry = await sImageMap.getImage(kLocalImageUrl);
      const expectedEntry = {
        contentUrl: "convertedUrl", 
        displayUrl: "convertedUrl", 
        status: EntryStatus.Error
      };
      expect(returnedEntry).toEqual(expectedEntry);
      expect(sImageMap.getCachedImage(kLocalImageUrl)).toEqual(expectedEntry);
      expect(sImageMap.getCachedImage("convertedUrl")).toEqual(expectedEntry);

      // A second call should try again and succeed   
      jest.spyOn(ImageUtils, "getImageDimensions").mockImplementation(() =>
        Promise.resolve({ src: placeholderImage, width: 200, height: 150 })
      );
      const getImagePromise2 = sImageMap.getImage(kLocalImageUrl);
      
      // TODO: it'd be good to check the intermediate state to see that the 
      // main entry is has a storing status. And then when addImage is called
      // the main entry and the copied entry have a computingDimensions state
      // Doing this would require setting up a delayed 

      const returnedEntry2 = await getImagePromise2;
      const expectedEntry2 = {
        contentUrl: "convertedUrl", 
        displayUrl: "convertedUrl", 
        width: 200,
        height: 150,
        status: EntryStatus.Ready
      };
      expect(returnedEntry2).toEqual(expectedEntry2);
      expect(sImageMap.getCachedImage(kLocalImageUrl)).toEqual(expectedEntry2);
      expect(sImageMap.getCachedImage("convertedUrl")).toEqual(expectedEntry2);
    });

    it("should handle entries that are in invalid states", async () => {
      expect.assertions(3);
      // Directly add an initial entry
      const initialEntry = {
        displayUrl: "bogus",
        status: EntryStatus.Storing
      };
      unsafeUpdate(() => sImageMap.images.set(kLocalImageUrl, initialEntry));

      const consoleSpy = jest.spyOn(global.console, "warn").mockImplementation();
      const getImagePromise = sImageMap.getImage(kLocalImageUrl);
      expect(sImageMap.getCachedImage(kLocalImageUrl)).toEqual({
        status: EntryStatus.Storing,
        displayUrl: placeholderImage
      });
      expect(consoleSpy).toBeCalledTimes(1);

      const returnedEntry = await getImagePromise;
      expect(returnedEntry).toEqual({
        status: EntryStatus.Ready,
        contentUrl: kLocalImageUrl,
        displayUrl: kLocalImageUrl,
        height: 150,
        width: 200
      });
    });
  });

  it("can update an image entry with syncContentUrl", () => {
    const kLocalImageUrl2 = kLocalImageUrl + "2";    
    const imageEntry2 = ImageMapEntry.create({
                          contentUrl: kLocalImageUrl2,
                          displayUrl: kLocalImageUrl2,
                          status: EntryStatus.Ready
                        });
    
    // It should add a new entry at the contentUrl
    // It doesn't create or modify the entry at the original url
    sImageMap._syncContentUrl(kLocalImageUrl, imageEntry2);

    const altEntry = sImageMap.getCachedImage(kLocalImageUrl2);
    expect(altEntry).toEqual(imageEntry2);
    // We never added an entry for the original url so it remains undefined
    expect(sImageMap.getCachedImage(kLocalImageUrl)).toBeUndefined();                   

    // syncs should update existing entries in place if they are in an error
    // status
    unsafeUpdate(() => altEntry!.status = EntryStatus.Error);
    const imageEntry2mod = ImageMapEntry.create({
      contentUrl: kLocalImageUrl2,
      displayUrl: kLocalImageUrl2,
      width: 20,
      height: 20,
      status: EntryStatus.Ready
    });
    sImageMap._syncContentUrl(kLocalImageUrl, imageEntry2mod);
    expect(altEntry).toEqual(imageEntry2mod);
  });

  it("can add a file image", () => {
    const storeSpy = jest.spyOn(ImageUtils, "storeFileImage")
                          .mockImplementation(() =>
                            Promise.resolve({ imageUrl: kCCImgFBRTDBUrl, imageData: kBlobUrl}));
    const file: any = { name: "foo" };
    return sImageMap.addFileImage(file)
            .then(image => {
              expect(storeSpy).toHaveBeenCalled();
              expect(image.contentUrl &&
                      firebaseRealTimeDBImagesHandler.match(image.contentUrl)).toBe(true);
              expect(image.displayUrl).toMatch(/^blob:/);
            });
  });

  describe("_addImage", () => {
    it("can update an image entry", () => {
      const kLocalImageUrl2 = kLocalImageUrl + "2";
  
      // Directly add an initial entry
      const initialEntry = {
        contentUrl: kLocalImageUrl,
        displayUrl: kLocalImageUrl,
        width: 20,
        height: 20,
        status: EntryStatus.Ready
      };
      unsafeUpdate(() => sImageMap.images.set(kLocalImageUrl, initialEntry));
  
      // It synchronously updates the entry and changes the status to computingDimensions.
      const changedStoreResult = {
        contentUrl: kLocalImageUrl2,
        displayUrl: kLocalImageUrl2,
        success: true
      };
      const addImagePromise = sImageMap._addImage(kLocalImageUrl, changedStoreResult);
  
      expect(sImageMap.getCachedImage(kLocalImageUrl)).toEqual({
        contentUrl: kLocalImageUrl2,
        displayUrl: kLocalImageUrl2,
        status: EntryStatus.ComputingDimensions
      });
  
      // Then asynchronously after the getImageDimensions call returns,
      // the status will be set to Ready, and the width and height will be set 
      // to the values returned by getImageDimensions
      return addImagePromise.then(() => {
        expect(sImageMap.getCachedImage(kLocalImageUrl)).toEqual({
          contentUrl: kLocalImageUrl2,
          displayUrl: kLocalImageUrl2,
          status: EntryStatus.Ready,
          width: 200,
          height: 150
        });
      });
    });
  
    it("handles entries with the error status", async () => {
      expect.assertions(7);

      // We reset the mocks because when the ImageMap is created it will request the 
      // dimensions of the placeholder image
      jest.resetAllMocks();
      const dimSpy = jest.spyOn(ImageUtils, "getImageDimensions");
      const storeResult = {
        contentUrl: kLocalImageUrl,
        displayUrl: kLocalImageUrl,
        success: false
      };
      const addImagePromise = sImageMap._addImage(kLocalImageUrl, storeResult);

      const expectedEntry = {
        contentUrl: kLocalImageUrl,
        displayUrl: kLocalImageUrl,
        status: EntryStatus.Error
      };
      
      // It synchronously adds the entry to the map
      const entryInMap = sImageMap.getCachedImage(kLocalImageUrl);
      expect(entryInMap).toEqual(expectedEntry);
      
      const entryReturned = await addImagePromise;
      // It returns the entry, without computing the dimensions
      expect(entryReturned).toEqual(expectedEntry);
      expect(dimSpy).not.toBeCalled();

      function resetEntryInMap(status: EntryStatus) {
        applySnapshot(entryInMap!, {
          status,
          contentUrl: "bogus",
          displayUrl: "radical"
        });
      }

      // It updates entries regardless of their status
      resetEntryInMap(EntryStatus.Ready);
      await sImageMap._addImage(kLocalImageUrl, storeResult);
      expect(entryInMap).toEqual(expectedEntry);

      resetEntryInMap(EntryStatus.ComputingDimensions);
      await sImageMap._addImage(kLocalImageUrl, storeResult);
      expect(entryInMap).toEqual(expectedEntry);

      resetEntryInMap(EntryStatus.Storing);
      await sImageMap._addImage(kLocalImageUrl, storeResult);
      expect(entryInMap).toEqual(expectedEntry);

      resetEntryInMap(EntryStatus.Error);
      await sImageMap._addImage(kLocalImageUrl, storeResult);
      expect(entryInMap).toEqual(expectedEntry);
    });

    it("handles when there is no displayUrl set", async () => {
      expect.assertions(6);
      const consoleSpy = jest.spyOn(global.console, "error").mockImplementation();
      const returnedEntry = await sImageMap._addImage(kLocalImageUrl, {
        contentUrl: kLocalImageUrl,
        success: false
      });
      expect(returnedEntry.status).toBe(EntryStatus.Error);
      expect(sImageMap.getCachedImage(kLocalImageUrl)).toBe(returnedEntry);
      expect(consoleSpy).toBeCalledTimes(1);
  
      // Even error entries are expected to have an displayUrl
      jest.resetAllMocks();
      const otherUrl = "fake-url";
      const returnedEntry2 = await sImageMap._addImage(otherUrl, {
        contentUrl: otherUrl,
        success: false
      });
      expect(returnedEntry2.status).toBe(EntryStatus.Error);
      expect(sImageMap.getCachedImage(otherUrl)).toBe(returnedEntry2);
      expect(consoleSpy).toBeCalledTimes(1);
    });
    
    it("handles an error in getDimensions", async () => {
      expect.assertions(3);

      // We reset the mocks because when the ImageMap is created it will request the 
      // dimensions of the placeholder image
      jest.resetAllMocks();
      const dimSpy = jest.spyOn(ImageUtils, "getImageDimensions").mockImplementation(() =>
        Promise.reject(new Error("mock error"))
      );

      const returnedEntry = await sImageMap._addImage(kLocalImageUrl, {
        displayUrl: kLocalImageUrl,
        contentUrl: kLocalImageUrl,
        success: true
      });
      expect(returnedEntry.status).toBe(EntryStatus.Error);
      expect(sImageMap.getCachedImage(kLocalImageUrl)).toBe(returnedEntry);
      expect(dimSpy).toBeCalled();
    });
  });
});
