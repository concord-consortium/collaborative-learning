import { autorun, flowResult, runInAction, when } from "mobx";

import { parseFirebaseImageUrl } from "../../shared/shared-utils";
import { DB } from "../lib/db";
import * as ImageUtils from "../utilities/image-utils";
import { PLACEHOLDER_IMAGE_PATH } from "../utilities/image-constants";
import { externalUrlImagesHandler, localAssetsImagesHandler,
  firebaseRealTimeDBImagesHandler, firebaseStorageImagesHandler,
  IImageHandler, ImageMapEntry, ImageMap,
  EntryStatus, IImageHandlerStoreOptions,
  IImageHandlerStoreResult,
  ImageMapEntrySnapshot} from "./image-map";

let sImageMap: ImageMap;

describe("ImageMap", () => {
  const kCurriculumUnitBaseUrl = "https://example.com/clue-curriculum/branch/main/sas";
  const kCurriculumUnitUrl = `${kCurriculumUnitBaseUrl}/config.json`;
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
          Promise.resolve({ src: PLACEHOLDER_IMAGE_PATH, width: 200, height: 150 }));
    sImageMap = new ImageMap();
    sImageMap.setUnitUrl(kCurriculumUnitUrl);
    sImageMap.setUnitCodeMap({"stretching-and-shrinking": "sas"});
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
    expect(sImageMap.isExternalUrl(PLACEHOLDER_IMAGE_PATH)).toBe(false);
    expect(sImageMap.isExternalUrl(kLocalImageUrl)).toBe(false);
    expect(sImageMap.isExternalUrl(kHttpImageUrl)).toBe(true);
    expect(sImageMap.isExternalUrl(kHttpsImageUrl)).toBe(true);
    expect(sImageMap.isExternalUrl(kFBStorageUrl)).toBe(false);
    expect(sImageMap.isExternalUrl(kDataUri)).toBe(true);

    expect(sImageMap.isPlaceholder(PLACEHOLDER_IMAGE_PATH)).toBe(true);
    expect(sImageMap.isPlaceholder(kLocalImageUrl)).toBe(false);
    expect(sImageMap.isPlaceholder(kHttpImageUrl)).toBe(false);
    expect(sImageMap.isPlaceholder(kHttpsImageUrl)).toBe(false);
    expect(sImageMap.isPlaceholder(kFBStorageUrl)).toBe(false);
    expect(sImageMap.isPlaceholder(kDataUri)).toBe(false);
  });

  it("test localAssetsImagesHandler", async () => {
    expectToMatch(localAssetsImagesHandler, [kLocalImageUrl]);
    await localAssetsImagesHandler.store(kLocalImageUrl)
            .then(storeResult => {
              expect(storeResult.contentUrl).toBe(kLocalImageUrl);
              expect(storeResult.displayUrl).toBe(`${kLocalImageUrl}`);
            });
    await localAssetsImagesHandler.store("curriculum/stretching-and-shrinking/images/image.png")
             .then(storeResult => {
               expect(storeResult.displayUrl).toBe(`${kCurriculumUnitBaseUrl}/images/image.png`);
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
                              Promise.resolve({ imageUrl: PLACEHOLDER_IMAGE_PATH, imageData: PLACEHOLDER_IMAGE_PATH}));
      p1 = externalUrlImagesHandler.store(kHttpsImage2, {db: createMockDB() })
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
                              Promise.resolve({ imageUrl: PLACEHOLDER_IMAGE_PATH, imageData: PLACEHOLDER_IMAGE_PATH}));
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
        expect(storeResult.displayUrl).toBe(PLACEHOLDER_IMAGE_PATH);
        expect(storeResult.success).toBe(false);
      });

    // handle invalid user Id
    mockDB.stores.user.id = "";
    firebaseStorageImagesHandler.store(kCCImgFBRTDBUrl, { db: mockDB })
      .then(storeResult => {
        // expect(storeSpy).not.toHaveBeenCalled();
        expect(storeResult.contentUrl).toBeUndefined();
        expect(storeResult.displayUrl).toBe(PLACEHOLDER_IMAGE_PATH);
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
        expect(storeResult.displayUrl).toBe(PLACEHOLDER_IMAGE_PATH);
      });
  });

  it("test firebaseStorageImagesHandler error handling", () => {
    const storeSpy = jest.spyOn(ImageUtils, "storeCorsImage")
                          .mockImplementation(() => Promise.reject(new Error("Conversion error")));
    return firebaseStorageImagesHandler.store(kCCImgFBRTDBUrl, { db: createMockDB() })
      .then(storeResult => {
        expect(storeSpy).toHaveBeenCalled();
        expect(storeResult.contentUrl).toBeUndefined();
        expect(storeResult.displayUrl).toBe(PLACEHOLDER_IMAGE_PATH);
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
          expect(storeResult.displayUrl).toBe(PLACEHOLDER_IMAGE_PATH);
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

  describe("isImageUrl", () => {
    it("returns true for valid image URLs and paths", () => {
      expect(kInputs.every((url) => {
        expect(sImageMap.isImageUrl(url)).toBe(true);
      }));
    });
    it("returns false for an invalid image URL or path", () => {
      expect(sImageMap.isImageUrl("hi")).toBe(false);
      expect(sImageMap.isImageUrl("4/5 + 3.4")).toBe(false);
      expect(sImageMap.isImageUrl("4/5 + 3.456")).toBe(false);
      expect(sImageMap.isImageUrl("4/5+3.456")).toBe(false);
    });
  });

  describe("getImage", () => {
    it("can handle falsy urls", () => {
      const consoleSpy = jest.spyOn(global.console, "warn").mockImplementation();
      expect(sImageMap.getCachedImage("")).toBeUndefined();
      return sImageMap.getImage("")
              .then(image => {
                expect(image.displayUrl).toBe(PLACEHOLDER_IMAGE_PATH);
                expect(image.width).toBe(200);
                expect(image.height).toBe(150);
                expect(consoleSpy).toBeCalledTimes(1);
              });
    });

    it("can retrieve placeholder image from cache", () => {
      expect(sImageMap.hasImage(PLACEHOLDER_IMAGE_PATH));
      expect(sImageMap.getCachedImage(PLACEHOLDER_IMAGE_PATH)).toEqual({
        displayUrl: PLACEHOLDER_IMAGE_PATH,
        width: 200,
        height: 150,
        status: EntryStatus.Ready,
        retries: 0
      });
      return sImageMap.getImage(PLACEHOLDER_IMAGE_PATH)
              .then(image => {
                expect(image.displayUrl).toBe(PLACEHOLDER_IMAGE_PATH);
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
      expect(imageEntry?.status).toBe(EntryStatus.PendingDimensions);

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

      imageDimensionResolve!({ src: PLACEHOLDER_IMAGE_PATH, width: 200, height: 150 });

      const image = await firstGetImagePromise;
      expect(image.contentUrl).toBe(kLocalImageUrl);
      expect(image.displayUrl).toBe(`${kLocalImageUrl}`);
      expect(image.width).toBe(200);
      expect(image.height).toBe(150);
      expect(image.status).toBe(EntryStatus.Ready);

      const image2 = await secondGetImagePromise;
      expect(image2).toBe(image);
    });

    it("returns the placeholder for unmatched images", () => {
      const consoleSpy = jest.spyOn(global.console, "warn").mockImplementation();
      return sImageMap.getImage(":")
              .then(image => {
                expect(image.displayUrl).toBe(PLACEHOLDER_IMAGE_PATH);
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
        Promise.resolve({ src: PLACEHOLDER_IMAGE_PATH, width: 200, height: 150 })
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
        status: EntryStatus.Error,
        retries: 0
      };
      expect(returnedEntry).toEqual(expectedEntry);
      expect(sImageMap.getCachedImage(kLocalImageUrl)).toEqual(expectedEntry);
      expect(sImageMap.getCachedImage("convertedUrl")).toEqual(expectedEntry);

      // A second call should try again and succeed
      jest.spyOn(ImageUtils, "getImageDimensions").mockImplementation(() =>
        Promise.resolve({ src: PLACEHOLDER_IMAGE_PATH, width: 200, height: 150 })
      );
      const getImagePromise2 = sImageMap.getImage(kLocalImageUrl);

      // TODO: it'd be good to check the intermediate state to see that the
      // main entry has a `PendingStorage` status. And then when addImage is called
      // the main entry and the copied entry have a `PendingDimensions` state
      // Doing this would require setting up a delayed getDimensions like above

      const returnedEntry2 = await getImagePromise2;
      const expectedEntry2 = {
        contentUrl: "convertedUrl",
        displayUrl: "convertedUrl",
        width: 200,
        height: 150,
        status: EntryStatus.Ready,
        retries: 1
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
        retries: 0,
        status: EntryStatus.PendingStorage
      };
      sImageMap._addOrUpdateEntry(kLocalImageUrl, initialEntry);

      const consoleSpy = jest.spyOn(global.console, "warn").mockImplementation();
      const getImagePromise = sImageMap.getImage(kLocalImageUrl);
      expect(sImageMap.getCachedImage(kLocalImageUrl)).toEqual({
        status: EntryStatus.PendingStorage,
        displayUrl: PLACEHOLDER_IMAGE_PATH,
        retries: 1
      });
      expect(consoleSpy).toBeCalledTimes(1);

      const returnedEntry = await getImagePromise;
      expect(returnedEntry).toEqual({
        status: EntryStatus.Ready,
        contentUrl: kLocalImageUrl,
        displayUrl: `${kLocalImageUrl}`,
        height: 150,
        width: 200,
        retries: 1
      });
    });

    it("limits the number times it retries entries that have failed", () => {
      const mockHandler: any = {
        async store(url: string, options?: IImageHandlerStoreOptions): Promise<IImageHandlerStoreResult> {
          return {
            displayUrl: PLACEHOLDER_IMAGE_PATH,
            success: false};
        }
      };
      jest.spyOn(sImageMap, "getHandler").mockImplementation((url: string) => mockHandler);
      const mockUrl = "fake-url-for-retry-test";

      let countOfGetImage = 0;
      let countOfAutorun = 0;
      let imageEntry: ImageMapEntry | undefined;
      let displayUrl: string | undefined;
      let lastStatus: EntryStatus | undefined;
      const disposer = autorun(() => {
        // This is a pattern that an observing component could use to display an
        // image entry. Without a retry limit in the ImageMap, in certain cases
        // this would loop forever This is because the status is flipping
        // between PendingStorage and Error.
        imageEntry = sImageMap.getCachedImage(mockUrl);
        if (!imageEntry || imageEntry.status === EntryStatus.Error) {
          sImageMap.getImage(mockUrl);
          countOfGetImage ++;
          imageEntry = sImageMap.getCachedImage(mockUrl);
        }
        // This displayURL is what the the observing component would use to
        // render the image.
        displayUrl = imageEntry?.displayUrl;

        // **This line is important.**
        // Without this line, there will be no looping. This line tells MobX the
        // autorun should be re-run whenever the status changes. The status is
        // being checked above, but only if imageEntry already exists. So the
        // first time through the autorun the status is not checked above.
        lastStatus = imageEntry?.status;

        countOfAutorun++;
        if (countOfAutorun > 15) {
          // Stop the loop if it is out of control
          // The autorun might get run extra times if the getImage or getCachedImage makes changes
          // to the image entry, this is why the limit is 15 instead of something lower
          disposer();
        }
      });

      return new Promise(resolve => setTimeout(resolve, 500))
      .then(() => {
        // Make sure the autorun is disposed so it doesn't continue to watch for changes
        disposer();
        expect(imageEntry?.retries).toBe(2);
        expect(lastStatus).toBe(EntryStatus.Error);
        expect(displayUrl).toBe(PLACEHOLDER_IMAGE_PATH);
        // 1st getImage: retries 0
        // 2nd getImage: retries 1
        // 3rd getImage: retries 2
        // 4th getImage: not retrying, retries 2, status error
        expect(countOfGetImage).toBe(4);
        // The autorun is run extra times which do not trigger getImage calls
        // I think these happen because the imageEntry is changed or the ImageMap is changed
        // How many time this runs isn't really important as long as it isn't excessive
        expect(countOfAutorun).toBeLessThan(10);
      });
    });
  });

  describe("getImageEntry", () => {
    it("returns undefined when no URL is passed to it", () => {
      const consoleSpy = jest.spyOn(global.console, "warn").mockImplementation();
      expect(sImageMap.getImageEntry("")).toBeUndefined();
      expect(consoleSpy).toBeCalled();
    });
    it("limits the number times it retries entries that have failed", () => {
      const mockHandler: any = {
        async store(url: string, options?: IImageHandlerStoreOptions): Promise<IImageHandlerStoreResult> {
          return {
            displayUrl: PLACEHOLDER_IMAGE_PATH,
            success: false};
        }
      };
      jest.spyOn(sImageMap, "getHandler").mockImplementation((url: string) => mockHandler);
      const mockUrl = "fake-url-for-retry-test";

      let countOfAutorun = 0;
      let imageEntry: ImageMapEntry | undefined;
      let displayUrl: string | undefined;
      let lastStatus: EntryStatus | undefined;
      const imageEntries: (ImageMapEntrySnapshot | null)[] = [];
      const disposer = autorun(() => {
        // This is a pattern that an observing component could use to display an
        // image entry. Without a retry limit in the ImageMap, in certain cases
        // this would loop forever This is because the status is flipping
        // between PendingStorage and Error.

        // The imageEntry is saved before and after the call to illustrate what is
        // changing on each time through the autorun loop
        imageEntries.push(imageEntry ? imageEntry.toJSON() : null);
        imageEntry = sImageMap.getImageEntry(mockUrl);
        imageEntries.push(imageEntry ? imageEntry.toJSON() : null);

        // This displayURL is what the the observing component would use to
        // render the image.
        displayUrl = imageEntry?.displayUrl;

        // **This line is important.**
        // Without this line, there will be no looping. This line tells MobX the
        // autorun should be re-run whenever the status changes. The status is
        // being checked above, but only if imageEntry already exists. So the
        // first time through the autorun the status is not checked above.
        lastStatus = imageEntry?.status;

        countOfAutorun++;
        if (countOfAutorun > 15) {
          // Stop the loop if it is out of control
          // The autorun might get run extra times if the getImage or getCachedImage makes changes
          // to the image entry, this is why the limit is 15 instead of something lower
          disposer();
        }
      });

      return new Promise(resolve => setTimeout(resolve, 500))
      .then(() => {
        // Make sure the autorun is disposed so it doesn't continue to watch for changes
        disposer();
        expect(imageEntry?.retries).toBe(2);
        expect(lastStatus).toBe(EntryStatus.Error);
        expect(displayUrl).toBe(PLACEHOLDER_IMAGE_PATH);
        expect(imageEntries).toEqual([
          // autorun #1 no imageEntry, then one that is pendingStorage
          null,
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 0, status: "pendingStorage" },

          // autorun #2 error'd imageEntry, then one that is retrying with pendingStorage
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 0, status: "error" },
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 1, status: "pendingStorage" },

          // autorun #3 triggered by async update of internal ImageMap state
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 1, status: "pendingStorage" },
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 1, status: "pendingStorage" },

          // autorun #4 error'd imageEntry, then one that is retrying with pendingStorage
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 1, status: "error" },
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 2, status: "pendingStorage" },

          // autorun #5 triggered by async update of internal ImageMap state
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 2, status: "pendingStorage" },
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 2, status: "pendingStorage" },

          // autorun #6 error'd imageEntry, then one that does not retry
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 2, status: "error" },
          { displayUrl: PLACEHOLDER_IMAGE_PATH, retries: 2, status: "error" },
        ]);
      });
    });
  });

  it("can update an image entry with syncContentUrl", () => {
    const kLocalImageUrl2 = kLocalImageUrl + "2";
    const imageEntry2 = ImageMapEntry.create({
                          contentUrl: kLocalImageUrl2,
                          displayUrl: kLocalImageUrl2,
                          status: EntryStatus.Ready,
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
    runInAction(() => altEntry!.status = EntryStatus.Error);
    const imageEntry2mod = ImageMapEntry.create({
      contentUrl: kLocalImageUrl2,
      displayUrl: kLocalImageUrl2,
      width: 20,
      height: 20,
      status: EntryStatus.Ready,
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
        status: EntryStatus.Ready,
        retries: 0
      };
      sImageMap._addOrUpdateEntry(kLocalImageUrl, initialEntry);

      // It synchronously updates the entry and changes the status to `PendingDimensions`.
      const changedStoreResult = {
        contentUrl: kLocalImageUrl2,
        displayUrl: kLocalImageUrl2,
        success: true
      };
      const addImagePromise = flowResult(sImageMap._addImage(kLocalImageUrl, changedStoreResult));

      expect(sImageMap.getCachedImage(kLocalImageUrl)).toEqual({
        contentUrl: kLocalImageUrl2,
        displayUrl: kLocalImageUrl2,
        status: EntryStatus.PendingDimensions,
        retries: 0
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
          height: 150,
          retries: 0
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
        status: EntryStatus.Error,
        retries: 0
      };

      // It synchronously adds the entry to the map
      const entryInMap = sImageMap.getCachedImage(kLocalImageUrl);
      expect(entryInMap).toEqual(expectedEntry);

      const entryReturned = await addImagePromise;
      // It returns the entry, without computing the dimensions
      expect(entryReturned).toEqual(expectedEntry);
      expect(dimSpy).not.toBeCalled();

      function resetEntryInMap(status: EntryStatus) {
        Object.assign(entryInMap!, {
          status,
          contentUrl: "bogus",
          displayUrl: "radical",
          retries: 0
        });
      }

      // It updates entries regardless of their status
      resetEntryInMap(EntryStatus.Ready);
      await sImageMap._addImage(kLocalImageUrl, storeResult);
      expect(entryInMap).toEqual(expectedEntry);

      resetEntryInMap(EntryStatus.PendingDimensions);
      await sImageMap._addImage(kLocalImageUrl, storeResult);
      expect(entryInMap).toEqual(expectedEntry);

      resetEntryInMap(EntryStatus.PendingStorage);
      await sImageMap._addImage(kLocalImageUrl, storeResult);
      expect(entryInMap).toEqual(expectedEntry);

      resetEntryInMap(EntryStatus.Error);
      await sImageMap._addImage(kLocalImageUrl, storeResult);
      expect(entryInMap).toEqual(expectedEntry);
    });

    it("handles an error in getDimensions", async () => {
      expect.assertions(3);

      // We reset the mocks because when the ImageMap is created it will request the
      // dimensions of the placeholder image
      jest.resetAllMocks();
      const dimSpy = jest.spyOn(ImageUtils, "getImageDimensions").mockImplementation(() =>
        Promise.reject(new Error("mock error"))
      );

      const returnedEntry = await flowResult(sImageMap._addImage(kLocalImageUrl, {
        displayUrl: kLocalImageUrl,
        contentUrl: kLocalImageUrl,
        success: true
      }));
      expect(returnedEntry.status).toBe(EntryStatus.Error);
      expect(sImageMap.getCachedImage(kLocalImageUrl)).toBe(returnedEntry);
      expect(dimSpy).toBeCalled();
    });
  });
});
