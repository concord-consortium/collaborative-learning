import { externalUrlImagesHandler, localAssetsImagesHandler,
        firebaseRealTimeDBImagesHandler, firebaseStorageImagesHandler,
        IImageHandler, ImageMapModel, ImageMapModelType } from "./image-map";
import * as ImageUtils from "../utilities/image-utils";
const urlParser = require("url");
const placeholderImage = require("../assets/image_placeholder.png");

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
  const kCCImgOriginal = "ccimg://path/to/image";
  const kCCImgFBRTDB = "ccimg://fbrtdb.concord.org/path/to/image";
  const kCCImgS3 = "ccimg://s3.concord.org/path/to/image";
  const kBlobUrl = "blob://some-blob-path";
  const kDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAABG2lUWH";
  const kInputs = [ kLocalImage, kHttpImage, kHttpsImage, kFBStorageUrl, kFBStorageRef,
                    kCCImgOriginal, kCCImgFBRTDB, kCCImgS3, kBlobUrl, kDataUri ];
  const kHandlers = [ localAssetsImagesHandler, externalUrlImagesHandler, externalUrlImagesHandler,
                      firebaseStorageImagesHandler, firebaseStorageImagesHandler,
                      firebaseRealTimeDBImagesHandler, firebaseRealTimeDBImagesHandler,
                      undefined, undefined, undefined];
  function expectToMatch(handler: IImageHandler, matches: string[]) {
    expect(kInputs.every((input, index) => {
      const didMatch = handler.match(input);
      const shouldMatch = matches.indexOf(input) >= 0;
      if (didMatch !== shouldMatch) {
        // tslint:disable-next-line:no-console
        console.log(`handler: ${handler.name}, input: ${input}, match: ${didMatch}, should: ${shouldMatch}`);
      }
      expect(didMatch).toBe(shouldMatch);
      return didMatch === shouldMatch;
    })).toBe(true);
  }

  it("test localAssetsImagesHandler", () => {
    expectToMatch(localAssetsImagesHandler, [kLocalImage]);
    return localAssetsImagesHandler.store(kLocalImage)
            .then(imageResult => {
              expect(imageResult.contentUrl).toBe(kLocalImage);
              expect(imageResult.displayUrl).toBe(kLocalImage);
            });
  });

  it("test externalUrlImagesHandler", () => {
    expectToMatch(externalUrlImagesHandler, [kHttpImage, kHttpsImage, kFBStorageUrl]);

    let p1: any;
    let p2: any;

    {
      const mockDB: any = { getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl)) };
      const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                            .mockImplementation(() =>
                              Promise.resolve({ imageUrl: kCCImgFBRTDB, imageData: kBlobUrl}));
      p1 = externalUrlImagesHandler.store(kHttpsImage, mockDB, "user")
        .then(imageResult => {
          expect(storeSpy).toHaveBeenCalled();
          expect(imageResult.contentUrl &&
                  firebaseRealTimeDBImagesHandler.match(imageResult.contentUrl)).toBe(true);
          expect(imageResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      const mockDB: any = { getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl)) };
      const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                            .mockImplementation(() => Promise.reject(new Error("Loading error")));
      p2 = externalUrlImagesHandler.store(kHttpsImage, mockDB, "user")
        .then(imageResult => {
          expect(storeSpy).toHaveBeenCalled();
          expect(imageResult.contentUrl).toBeUndefined();
          expect(imageResult.displayUrl).toBeUndefined();
        });
    }
    return Promise.all([p1, p2]);
  });

  it("test firebaseStorageImagesHandler on firebase storage URL", () => {
    expectToMatch(firebaseStorageImagesHandler, [kFBStorageUrl, kFBStorageRef]);

    const mockDB: any = {
            firebase: { getPublicUrlFromStore: (path?: string, url?: string) => Promise.resolve(kFBStorageUrl) },
            getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl))
          };
    const storeSpy = jest.spyOn(ImageUtils, "storeCorsImage")
                          .mockImplementation(() => Promise.resolve({ imageUrl: kCCImgFBRTDB, imageData: kBlobUrl}));
    return firebaseStorageImagesHandler.store(kFBStorageUrl, mockDB, "user")
      .then(imageResult => {
        expect(storeSpy).toHaveBeenCalled();
        expect(imageResult.contentUrl &&
                firebaseRealTimeDBImagesHandler.match(imageResult.contentUrl)).toBe(true);
        expect(imageResult.displayUrl).toMatch(/^blob:/);
      });
  });

  it("test firebaseStorageImagesHandler on firebase storage reference", () => {
    const mockDB: any = {
            firebase: { getPublicUrlFromStore: (path?: string, url?: string) => Promise.resolve(kFBStorageUrl) },
            getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl))
          };
    const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                          .mockImplementation(() => Promise.resolve({ imageUrl: kCCImgFBRTDB, imageData: kBlobUrl}));
    return firebaseStorageImagesHandler.store(kFBStorageRef, mockDB, "user")
      .then(imageResult => {
        expect(storeSpy).toHaveBeenCalled();
        expect(imageResult.contentUrl &&
                firebaseRealTimeDBImagesHandler.match(imageResult.contentUrl)).toBe(true);
        expect(imageResult.displayUrl).toMatch(/^blob:/);
      });
  });

  it("test firebaseStorageImagesHandler error handling", () => {
    const mockDB: any = {
            firebase: { getPublicUrlFromStore: (path?: string, url?: string) => Promise.resolve(undefined) },
            getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl))
          };
    const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                          .mockImplementation(() => Promise.resolve({ imageUrl: kCCImgFBRTDB, imageData: kBlobUrl}));
    return firebaseStorageImagesHandler.store(kCCImgFBRTDB, mockDB, "user")
      .then(imageResult => {
        // expect(storeSpy).not.toHaveBeenCalled();
        expect(imageResult.contentUrl).toBe(placeholderImage);
        expect(imageResult.displayUrl).toBe(placeholderImage);
      });
  });

  it("test firebaseStorageImagesHandler error handling", () => {
    const mockDB: any = {
            firebase: { getPublicUrlFromStore: (path?: string, url?: string) =>
                                                  Promise.reject(new Error("Conversion error")) },
            getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl))
          };
    const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                          .mockImplementation(() => Promise.reject(new Error("Conversion error")));
    return firebaseStorageImagesHandler.store(kCCImgFBRTDB, mockDB, "user")
      .then(imageResult => {
        // expect(storeSpy).not.toHaveBeenCalled();
        expect(imageResult.contentUrl).toBe(placeholderImage);
        expect(imageResult.displayUrl).toBe(placeholderImage);
      });
  });

  it("test firebaseStorageImagesHandler error handling", () => {
    const mockDB: any = {
            firebase: { getPublicUrlFromStore: (path?: string, url?: string) => Promise.resolve(kFBStorageUrl) },
            getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl))
          };
    const storeSpy = jest.spyOn(ImageUtils, "storeImage")
                          .mockImplementation(() => Promise.reject(new Error("Conversion error")));
    return firebaseStorageImagesHandler.store(kCCImgFBRTDB, mockDB, "user")
      .then(imageResult => {
        expect(storeSpy).toHaveBeenCalled();
        expect(imageResult.contentUrl).toBe(kCCImgFBRTDB);
        expect(imageResult.displayUrl).toBe(kBlobUrl);
      });
  });

  it("test firebaseRealTimeDBImagesHandler", () => {
    const parsedPath = urlParser.parse(kCCImgFBRTDB).path;
    const path = parsedPath.startsWith("/") ? parsedPath.slice(1) : parsedPath;
    expectToMatch(firebaseRealTimeDBImagesHandler, [kCCImgOriginal, kCCImgFBRTDB]);
    let p1: any;
    let p2: any;
    let p3: any;
    {
      const mockDB: any = { getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl)) };
      p1 = firebaseRealTimeDBImagesHandler.store(kCCImgOriginal, mockDB, "user")
        .then(imageResult => {
          expect(mockDB.getImageBlob).toHaveBeenCalledWith(path);
          expect(imageResult.contentUrl).toBe(kCCImgFBRTDB);
          expect(imageResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      const mockDB: any = { getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl)) };
      p2 = firebaseRealTimeDBImagesHandler.store(kCCImgFBRTDB, mockDB, "user")
        .then(imageResult => {
          expect(mockDB.getImageBlob).toHaveBeenCalledWith(path);
          expect(imageResult.contentUrl).toBe(kCCImgFBRTDB);
          expect(imageResult.displayUrl).toMatch(/^blob:/);
        });
    }
    {
      const mockDB: any = { getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl)) };
      p3 = firebaseRealTimeDBImagesHandler.store("", mockDB, "user")
        .then(imageResult => {
          expect(imageResult.contentUrl).toBeUndefined();
          expect(imageResult.displayUrl).toBeUndefined();
        });
    }
    return Promise.all([p1, p2, p3]);
  });

  it("can be initialized", () => {
    const mockDB: any = { getImageBlob: jest.fn(() => Promise.resolve(kBlobUrl)) };
    sImageMap.initialize(mockDB, "user");

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
    return sImageMap.getImage("")
            .then(image => {
              expect(image.displayUrl).toBe(placeholderImage);
              expect(image.width).toBe(200);
              expect(image.height).toBe(150);
            });
  });

  it("can retrieve placeholder image from cache", () => {
    expect(sImageMap.hasImage(placeholderImage));
    return sImageMap.getImage(placeholderImage)
            .then(image => {
              expect(image.displayUrl).toBe(placeholderImage);
              expect(image.width).toBe(200);
              expect(image.height).toBe(150);
            });
  });

  it("can add an image", () => {
    const dimSpy = jest.spyOn(ImageUtils, "getImageDimensions")
                        .mockImplementation(() =>
                          Promise.resolve({ src: placeholderImage, width: 200, height: 150 }));
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
            });
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
