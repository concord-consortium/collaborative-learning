import { externalUrlImagesHandler, localAssetsImagesHandler,
        firebaseRealTimeDBImagesHandler, firebaseStorageImagesHandler,
        IImageHandler, ImageMapEntry, ImageMapModel, ImageMapModelType } from "./image-map";
import { parseFirebaseImageUrl } from "../../functions/src/shared-utils";
import { DB } from "../lib/db";
import * as ImageUtils from "../utilities/image-utils";
import placeholderImage from "../assets/image_placeholder.png";

let sImageMap: ImageMapModelType;

beforeAll(() => {
  jest.spyOn(ImageUtils, "getImageDimensions")
      .mockImplementation(() =>
        Promise.resolve({ src: placeholderImage, width: 200, height: 150 }));
  sImageMap = ImageMapModel.create();
});

describe("ImageMap", () => {
  const kLocalImage = "assets/logo_tw.png";
  const kHttpImage = "http://icon.cat/img/icon_loop.png";
  const kHttpsImage = "https://icon.cat/img/icon_loop.png";
  const kFBStorageUrl = "https://firebasestorage.googleapis.com/path/to/image";
  const kFBStorageRef = "/dev/w8podRScLDbiu5zK3bE6323PY6G3/portals/localhost/coin-background.png";
  const kCCImgOriginal = "ccimg://imagePath";
  const kCCImgFBRTDB = "ccimg://fbrtdb.concord.org/imagePath";
  // starting with CLUE 2.1.3, image paths include the class hash
  const kCCImgClassFBRTDB = "ccimg://fbrtdb.concord.org/classHash/imagePath";
  const kCCImgS3 = "ccimg://s3.concord.org/path/to/image";
  const kBlobUrl = "blob://some-blob-path";
  const kDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAABG2lUWH";
  const kInputs = [
          kLocalImage, kHttpImage, kHttpsImage, kFBStorageUrl, kFBStorageRef,
          kCCImgOriginal, kCCImgFBRTDB, kCCImgClassFBRTDB, kDataUri, kCCImgS3, kBlobUrl];
  const kHandlers = [
          localAssetsImagesHandler, externalUrlImagesHandler, externalUrlImagesHandler,
          firebaseStorageImagesHandler, firebaseStorageImagesHandler,
          firebaseRealTimeDBImagesHandler, firebaseRealTimeDBImagesHandler, firebaseRealTimeDBImagesHandler,
          externalUrlImagesHandler, undefined, undefined ];

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
    expect(sImageMap.isExternalUrl(kLocalImage)).toBe(false);
    expect(sImageMap.isExternalUrl(kHttpImage)).toBe(true);
    expect(sImageMap.isExternalUrl(kHttpsImage)).toBe(true);
    expect(sImageMap.isExternalUrl(kFBStorageUrl)).toBe(false);
    expect(sImageMap.isExternalUrl(kDataUri)).toBe(true);

    expect(sImageMap.isPlaceholder(placeholderImage)).toBe(true);
    expect(sImageMap.isPlaceholder(kLocalImage)).toBe(false);
    expect(sImageMap.isPlaceholder(kHttpImage)).toBe(false);
    expect(sImageMap.isPlaceholder(kHttpsImage)).toBe(false);
    expect(sImageMap.isPlaceholder(kFBStorageUrl)).toBe(false);
    expect(sImageMap.isPlaceholder(kDataUri)).toBe(false);
  });

  it("test localAssetsImagesHandler", () => {
    expectToMatch(localAssetsImagesHandler, [kLocalImage]);
    return localAssetsImagesHandler.store(kLocalImage)
            .then(imageResult => {
              expect(imageResult.contentUrl).toBe(kLocalImage);
              expect(imageResult.displayUrl).toBe(kLocalImage);
            });
  });

  it("test externalUrlImagesHandler", () => {
    expectToMatch(externalUrlImagesHandler, [kHttpImage, kHttpsImage, kFBStorageUrl, kDataUri]);

    let p1: any;
    let p2: any;

    {
      const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                            .mockImplementation(() =>
                              Promise.resolve({ imageUrl: kCCImgFBRTDB, imageData: kBlobUrl}));
      p1 = externalUrlImagesHandler.store(kHttpsImage, { db: createMockDB() })
        .then(imageResult => {
          expect(storeSpy).toHaveBeenCalled();
          expect(imageResult.contentUrl &&
                  firebaseRealTimeDBImagesHandler.match(imageResult.contentUrl)).toBe(true);
          expect(imageResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                            .mockImplementation(() => Promise.reject(new Error("Loading error")));
      p2 = externalUrlImagesHandler.store(kHttpsImage, { db: createMockDB() })
        .then(imageResult => {
          expect(storeSpy).toHaveBeenCalled();
          expect(imageResult.contentUrl).toBe(kHttpsImage);
          expect(imageResult.displayUrl).toBe(kHttpsImage);
        });
    }
    return Promise.all([p1, p2]);
  });

  it("test externalUrlImagesHandler placeholder conversion", () => {
    let p1: any;
    let p2: any;

    {
      const kHttpsImage2 = kHttpsImage + "2";
      const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                            .mockImplementation(() =>
                              Promise.resolve({ imageUrl: placeholderImage, imageData: placeholderImage}));
      p1 = externalUrlImagesHandler.store(kHttpsImage2, { db: createMockDB() })
        .then(imageResult => {
          expect(storeSpy).toHaveBeenCalled();
          expect(imageResult.contentUrl).toBe(kHttpsImage2);
          expect(imageResult.displayUrl).toBe(kHttpsImage2);
        });
    }
    {
      const kHttpsImage3 = kHttpsImage + "3";
      const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                            .mockImplementation(() =>
                              Promise.resolve({ imageUrl: placeholderImage, imageData: placeholderImage}));
      p2 = externalUrlImagesHandler.store(kHttpsImage3, { db: createMockDB({ stores: { user: { id: "" }} }) })
        .then(imageResult => {
          expect(storeSpy).toHaveBeenCalled();
          expect(imageResult.contentUrl).toBe(kHttpsImage3);
          expect(imageResult.displayUrl).toBe(kHttpsImage3);
        });
    }
    return Promise.all([p1, p2]);
  });

  it("test firebaseStorageImagesHandler on firebase storage URL", () => {
    expectToMatch(firebaseStorageImagesHandler, [kFBStorageUrl, kFBStorageRef]);

    const storeSpy = jest.spyOn(ImageUtils, "storeCorsImage")
                          .mockImplementation(() => Promise.resolve({ imageUrl: kCCImgFBRTDB, imageData: kBlobUrl}));
    return firebaseStorageImagesHandler.store(kFBStorageUrl, { db: createMockDB() })
      .then(imageResult => {
        expect(storeSpy).toHaveBeenCalled();
        expect(imageResult.contentUrl &&
                firebaseRealTimeDBImagesHandler.match(imageResult.contentUrl)).toBe(true);
        expect(imageResult.displayUrl).toMatch(/^blob:/);
      });
  });

  it("test firebaseStorageImagesHandler on firebase storage reference", () => {
    const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                          .mockImplementation(() => Promise.resolve({ imageUrl: kCCImgFBRTDB, imageData: kBlobUrl}));
    return firebaseStorageImagesHandler.store(kFBStorageRef, { db: createMockDB() })
      .then(imageResult => {
        expect(storeSpy).toHaveBeenCalled();
        expect(imageResult.contentUrl &&
                firebaseRealTimeDBImagesHandler.match(imageResult.contentUrl)).toBe(true);
        expect(imageResult.displayUrl).toMatch(/^blob:/);
      });
  });

  it("test firebaseStorageImagesHandler error handling", () => {
    const mockDB = createMockDB({
            firebase: { getPublicUrlFromStore: (path?: string, url?: string) => Promise.resolve(undefined) }
          });
    // const storeSpy = jest.spyOn(ImageUtils, "storeImage")
    //                       .mockImplementation(() => Promise.resolve({ imageUrl: kCCImgFBRTDB, imageData: kBlobUrl}));
    firebaseStorageImagesHandler.store(kCCImgFBRTDB, { db: mockDB })
      .then(imageResult => {
        // expect(storeSpy).not.toHaveBeenCalled();
        expect(imageResult.contentUrl).toBe(placeholderImage);
        expect(imageResult.displayUrl).toBe(placeholderImage);
      });

    // handle invalid user Id
    mockDB.stores.user.id = "";
    firebaseStorageImagesHandler.store(kCCImgFBRTDB, { db: mockDB })
      .then(imageResult => {
        // expect(storeSpy).not.toHaveBeenCalled();
        expect(imageResult.contentUrl).toBe(placeholderImage);
        expect(imageResult.displayUrl).toBe(placeholderImage);
      });
  });

  it("test firebaseStorageImagesHandler error handling", () => {
    const mockDB = createMockDB({
            firebase: { getPublicUrlFromStore: (path?: string, url?: string) =>
                                                  Promise.reject(new Error("Conversion error")) }
          });
    // const storeSpy = jest.spyOn(ImageUtils, "storeImage")
    //                       .mockImplementation(() => Promise.reject(new Error("Conversion error")));
    return firebaseStorageImagesHandler.store(kCCImgFBRTDB, { db: mockDB })
      .then(imageResult => {
        // expect(storeSpy).not.toHaveBeenCalled();
        expect(imageResult.contentUrl).toBe(placeholderImage);
        expect(imageResult.displayUrl).toBe(placeholderImage);
      });
  });

  it("test firebaseStorageImagesHandler error handling", () => {
    const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                          .mockImplementation(() => Promise.reject(new Error("Conversion error")));
    return firebaseStorageImagesHandler.store(kCCImgFBRTDB, { db: createMockDB() })
      .then(imageResult => {
        expect(storeSpy).toHaveBeenCalled();
        expect(imageResult.contentUrl).toBe(kCCImgFBRTDB);
        expect(imageResult.displayUrl).toBe(kBlobUrl);
      });
  });

  it("test firebaseRealTimeDBImagesHandler", () => {
    const { imageKey } = parseFirebaseImageUrl(kCCImgClassFBRTDB);
    expectToMatch(firebaseRealTimeDBImagesHandler, [kCCImgOriginal, kCCImgFBRTDB, kCCImgClassFBRTDB]);
    let p1: any;
    let p2: any;
    let p3: any;
    let p4: any;
    {
      const mockDB = createMockDB();
      p1 = firebaseRealTimeDBImagesHandler.store(kCCImgOriginal, { db: mockDB })
        .then(imageResult => {
          // url doesn't include classHash, so we use the firebase function
          expect(mockDB.getCloudImageBlob).toHaveBeenCalledWith(kCCImgFBRTDB);
          expect(imageResult.contentUrl).toBe(kCCImgFBRTDB);
          expect(imageResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      const mockDB = createMockDB();
      p2 = firebaseRealTimeDBImagesHandler.store(kCCImgFBRTDB, { db: mockDB })
        .then(imageResult => {
          // url doesn't include classHash, so we use the firebase function
          expect(mockDB.getCloudImageBlob).toHaveBeenCalledWith(kCCImgFBRTDB);
          expect(imageResult.contentUrl).toBe(kCCImgFBRTDB);
          expect(imageResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      const mockDB = createMockDB();
      p3 = firebaseRealTimeDBImagesHandler.store(kCCImgClassFBRTDB, { db: mockDB })
        .then(imageResult => {
          // url does include classHash, so we can retrieve it locally
          expect(mockDB.getImageBlob).toHaveBeenCalledWith(imageKey);
          expect(imageResult.contentUrl).toBe(kCCImgClassFBRTDB);
          expect(imageResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      p4 = firebaseRealTimeDBImagesHandler.store("", { db: createMockDB() })
        .then(imageResult => {
          expect(imageResult.contentUrl).toBeUndefined();
          expect(imageResult.displayUrl).toBeUndefined();
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
      height: 150
    });
    return sImageMap.getImage(placeholderImage)
            .then(image => {
              expect(image.displayUrl).toBe(placeholderImage);
              expect(image.width).toBe(200);
              expect(image.height).toBe(150);
            });
  });

  it("can add an image and notify listeners", () => {
    const dimSpy = jest.spyOn(ImageUtils, "getImageDimensions")
                        .mockImplementation(() =>
                          Promise.resolve({ src: placeholderImage, width: 200, height: 150 }));
    const listener = jest.fn();
    sImageMap.registerListener(kLocalImage, "foo", listener);
    sImageMap.registerListener(kLocalImage, "bar", listener);
    const count = sImageMap.imageCount;
    return sImageMap.getImage(kLocalImage)
            .then(image => {
              expect(sImageMap.imageCount).toBe(count + 1);
              expect(sImageMap.hasImage(kLocalImage));
              expect(dimSpy).toHaveBeenCalled();
              expect(image.contentUrl).toBe(kLocalImage);
              expect(image.displayUrl).toBe(kLocalImage);
              expect(image.width).toBe(200);
              expect(image.height).toBe(150);
              expect(listener).toHaveBeenCalledTimes(2);
            });
  });

  it("can update an image entry", () => {
    const kLocalImage2 = kLocalImage + "2";
    const kLocalImage2b = kLocalImage2 + "b";
    const imageEntry2 = ImageMapEntry.create({
                          ...sImageMap.getCachedImage(kLocalImage),
                          contentUrl: kLocalImage2,
                          displayUrl: kLocalImage2
                        });
    sImageMap.syncContentUrl(kLocalImage, imageEntry2);
    expect(sImageMap.getCachedImage(kLocalImage2)).toEqual(imageEntry2);

    const imageEntry2b = ImageMapEntry.create({
                          ...imageEntry2,
                          contentUrl: kLocalImage2b,
                          displayUrl: kLocalImage2b
                        });
    sImageMap.addImage(kLocalImage2, imageEntry2b);
    expect(sImageMap.getCachedImage(kLocalImage2)).toEqual(imageEntry2b);
  });

  it("returns the placeholder for unmatched images", () => {
    return sImageMap.getImage("foo")
            .then(image => {
              expect(image.displayUrl).toBe(placeholderImage);
            });
  });

  it("can add a file image", () => {
    const storeSpy = jest.spyOn(ImageUtils, "storeFileImage")
                          .mockImplementation(() =>
                            Promise.resolve({ imageUrl: kCCImgFBRTDB, imageData: kBlobUrl}));
    const file: any = { name: "foo" };
    return sImageMap.addFileImage(file)
            .then(image => {
              expect(storeSpy).toHaveBeenCalled();
              expect(image.contentUrl &&
                      firebaseRealTimeDBImagesHandler.match(image.contentUrl)).toBe(true);
              expect(image.displayUrl).toMatch(/^blob:/);
            });
  });
});
