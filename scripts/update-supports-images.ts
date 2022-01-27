#!/usr/bin/node

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts
// $ node --loader ts-node/esm update-supports-images.ts

import admin from "firebase-admin";

interface IFirestoreMultiClassSupport {
  appMode?: string; // frequently missing in supports published before 2.1.3 ¯\_(ツ)_/¯
  uid: string;
  classPath?: string; // frequently missing in supports published before 2.1.3 ¯\_(ツ)_/¯
  classes: string[];
  content: string;
  originDoc: string;
  properties: Record<string, string>;
  platform_id: string;
  context_id: string;
  resource_link_id: string;
  resource_url: string;
}

// The `images` collection is used during publication of supports to map old-style
// image urls to the class context in which the image contents actually reside.
// From 2.1.3 onward newly uploaded images use new-style image urls and newly
// published supports reference images using new-style image urls, this need only
// include images referenced in supports published prior to 2.1.3.
interface IFirestoreImage {
  url: string;  // old-style without class hash
  classPath: string;
  // LTI fields
  platform_id: string;
  context_id: string; // class hash
}

// The `mcimages` collection is used to determine whether a given image reference
// has been shared with a particular class. Queries are expected to be done by
// old-style image url (for backward compatibility) and array-contains on the
// `classes` field. There is an entry in the `mcimages` collection for each
// image referenced by each support, so a query may return multiple `mcimages`
// entries. From a permissions standpoint, the client can access the image data
// if the query returns any entries.
interface IFirestoreMultiClassImage {
  url: string;  // old-style without class hash
  classes: string[];
  classPath: string;
  supportKey: string;
  // LTI fields
  platform_id: string;
  context_id: string; // class hash
  resource_link_id: string;
  resource_url: string;
}

interface IActiveImageMatch {
  url: string;  // content url; may be legacy or newer (with or without class hash)
  legacyUrl: string;
  key: string;
  start: number;
  tileIndex: number;
  tileType: string;
}

type TClassHash = string;
type TImageKey = string;
type TImageUrl = string;
type TSupportKey = string;

// set of active images indexed by supportId
const activeImagesMap: Record<TSupportKey, IActiveImageMatch[]> = {};
// set of multi-class image entries required for a given support
const multiClassImagesMap: Record<TSupportKey, IFirestoreMultiClassImage[]> = {};

type ImageResolutions = Record<TImageUrl, TClassHash>;
type SupportImageResolutions = Record<TSupportKey, ImageResolutions>;
const supportImageResolutions: SupportImageResolutions = {};
// key is firebase image key
const firestoreImages: Record<TImageKey, IFirestoreImage> = {};

// Fetch the service account key JSON file contents; must be in same folder as script
const credential = admin.credential.cert('./serviceAccountKey.json');
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL: 'https://collaborative-learning-ec215.firebaseio.com'
});

// Controls whether to validate the presence of the image data in the expected class
// and to search for it in all relevant classes if it's not in the expected class.
// Useful for limiting the scope of the script while developing/debugging it.
function shouldCheckImageContents(supportIndex: number, classHash?: TClassHash, supportKey?: TSupportKey) {
  return true;
  // return classHash?.startsWith("2be8");
}

// Controls whether to log information about individual supports.
// Useful for limiting the scope of the output to supports of particular interest.
// Summary logging is always performed and is not affected by this function.
function shouldLogIndividualSupports(supportIndex: number, classHash?: TClassHash, supportKey?: TSupportKey) {
  return false;
  // return supportId?.startsWith("OkJxqJ");
}

// regular expression for identifying tiles that can reference images in document content
const kImageTileRegex = /"type":"(Drawing|Geometry|Image)"/g;

// regular expression for identifying firebase image urls in document content
// capture group 1: "url" (Drawing, Image) or "parents" (Geometry)
//                       |-------------------------|
// capture group 2: image url                            |---------------------------------------|
// capture group 3: image key (includes class hash for modern image urls)                 |-----|
const kImageUrlRegex = /(\\"url\\":|\\"parents\\":\[)\\"(ccimg:\/\/fbrtdb\.concord\.org\/([^\\"]+))\\"/g;

function parseImageUrl(url: string) {
  const match = /ccimg:\/\/fbrtdb\.concord\.org\/([^/]+)(\/([^/]+))?/.exec(url);
  const imageKey = match?.[3] || match?.[1];
  const imageClassHash = match?.[3] ? match?.[1] : undefined;
  const legacyUrl = imageClassHash ? url.replace(`/${imageClassHash}`, ""): url;
  return { imageClassHash, imageKey, legacyUrl };
}

// possible paths are currently hard-coded; could be extended to script argument down the road
const basePaths: Record<string, string> = {
  kAuthedLearnFirestoreBasePath: "authed/learn_concord_org",
  kAuthedLearnStagingFirestoreBasePath: "authed/learn_staging_concord_org",
  kDemoCLUEFirestoreBasePath: "demo/CLUE"
};
// specifies the set of supports to be analyzed/validated
const kFirestoreBasePath = basePaths.kDemoCLUEFirestoreBasePath;
const kFirestoreImagesPath = `${kFirestoreBasePath}/images`;
const kFirestoreMCImagesPath = `${kFirestoreBasePath}/mcimages`;
const kFirestoreMCSupportsPath = `${kFirestoreBasePath}/mcsupports`;

// if true, log the firestore entries to be created without creating them
const kDryRun = true;

function buildFirebaseClassPath(portal?: string, classHash?: TClassHash, supportKey?: TSupportKey) {
  return kFirestoreBasePath.startsWith("demo")
          ? `/${kFirestoreBasePath}/portals/demo/classes/${classHash}`
          : `/authed/portals/${portal?.replace(/\./g, "_")}/classes/${classHash}`;
}

function buildFirebaseImagePath(classPath: string, imageKey: string) {
  return `${classPath}/images/${imageKey}`;
}

console.log(`***** Base Path: ${kFirestoreBasePath} *****`);

admin.firestore()
  .collection(kFirestoreMCSupportsPath)
  .listDocuments()
  .then(async docRefs => {
    let invalidMetadataCount = 0;
    let deletedCount = 0;
    let towleJonesCount = 0;
    let supportsWithImageTiles = 0;
    let supportsWithMissingImages = 0;
    let supportsWithDisplacedImages = 0;
    let totalImageTileCount = 0;
    let totalImageUrlCount = 0;
    let activeImageUrlCount = 0;
    const imageCountsPerTileType: Record<string, number> = { Image: 0, Geometry: 0, Drawing: 0 };
    const originDocs = new Set<string>();
    const uniqueImageUrls = new Set<string>();
    // await processing of all supports
    let resolvedDocuments = 0;
    const docs = await Promise.all(docRefs.map((docRef, docIndex) => new Promise((resolve, reject) => {
      docRef.get()
        .then(doc => {
          // process each support
          const docPath = docRef.path;
          const parts = docPath.split("/");
          const supportKey = parts[parts.length - 1];
          const docData: IFirestoreMultiClassSupport | undefined = doc?.data() as any;
          const { platform_id, context_id: classHash, classPath, classes, content } = docData || {};
          const imageTileMatches = [...(content?.matchAll(kImageTileRegex) || [])]
                                    .map(match => {
                                      const [ , tileType] = match;
                                      const { index: start = 0 } = match;
                                      return { tileType, start };
                                    });
          // returns the index of the tile containing the url reference
          const getTileIndex = (urlStart: number) => imageTileMatches.findIndex((tileMatch, i) => {
            const thisMatch = tileMatch.start < urlStart;
            const nextMatch = (i < imageTileMatches.length - 1) && ((imageTileMatches[i + 1].start < urlStart));
            return thisMatch && !nextMatch;
          });
          // find all the firebase image urls in the support content
          const imageMatches = [...(content?.matchAll(kImageUrlRegex) || [])]
                                .map(match => {
                                  const [ , , url, path] = match;
                                  const { imageKey: key = path, legacyUrl } = parseImageUrl(url);
                                  const { index: start = 0 } = match;
                                  const tileIndex = getTileIndex(start);
                                  const tileType = imageTileMatches[tileIndex].tileType;
                                  // console.log(`Image match: tileIndex: ${tileIndex},`,
                                  //             `tileType: ${tileType}, ${JSON.stringify(match.slice(1))}`);
                                  ++imageCountsPerTileType[tileType];
                                  return { url, legacyUrl, key, path, start, tileIndex, tileType };
                                });
          // filter out the "inactive" images, e.g. an image that has been replaced by a newer one in an image tile
          const activeImages = imageMatches.filter((match, i) => {
            // Drawing tiles support multiple images so all can be active.
            // Note that this doesn't account for image objects that may have been subsequently deleted,
            // so the image will continue to be shared after all objects that display it have been deleted.
            // Handling this case would require more detailed parsing of Drawing content.
            if (match.tileType === "Drawing") return true;
            // Geometry and Image tiles only support a single image, so only the last is active
            return (i === imageMatches.length - 1) || (match.tileIndex !== imageMatches[i + 1].tileIndex);
          });
          activeImagesMap[supportKey] = activeImages;

          if (activeImages.length) {
            totalImageUrlCount += imageMatches.length;
            activeImageUrlCount += activeImages.length;
            // function can be modified above to control when image contents are analyzed
            if (shouldCheckImageContents(docIndex, classHash, supportKey)) {
              // classPath is sometimes null in mcsupports documents ¯\_(ツ)_/¯
              const _classPath = classPath || buildFirebaseClassPath(platform_id, classHash);
              // await results of searches for image contents in class from which support was published
              Promise.all(activeImages.map(({ url, key }) => {
                url && uniqueImageUrls.add(url);
                const imagePath = buildFirebaseImagePath(_classPath, key);
                return new Promise((resolve, reject) => {
                  admin.database().ref(imagePath).once("value")
                    // if found we resolve with the image content
                    .then(snapshot => resolve(snapshot.val()))
                    // if not found we resolve with undefined
                    .catch(e => resolve(undefined));
                });
              })).then(imageDocs => {
                let displacedImages = 0;
                // build map of resolved image locations
                supportImageResolutions[supportKey] = {};
                Promise.all(imageDocs.map((imageDoc, imageDocIndex) => {
                  const { url: _url, legacyUrl, key: imageKey } = activeImages[imageDocIndex];
                  _url && (imageDoc != null) && classHash && (supportImageResolutions[supportKey][_url] = classHash);
                  return new Promise((resolve, reject) => {
                    // resolve with the image contents found in the previous step, if available
                    if (imageDoc != null) {
                      imageKey && platform_id && classHash && !firestoreImages[imageKey] &&
                        (firestoreImages[imageKey] = {
                          url: legacyUrl,
                          classPath: _classPath,
                          platform_id,
                          context_id: classHash
                        });
                      resolve(imageDoc);
                    }
                    else {
                      // If the image contents were not found in the class context of the document
                      // from which the support was published (e.g. the image had previously been
                      // copied from another multi-class support published from another class), then
                      // we search for it in all classes that have access to the support.
                      // Await the results of searching for the image in all relevant classes.
                      Promise.all((classes || []).map(altClassHash => {
                        // build the expected path to the image data in the alternate class
                        const altClassPath = buildFirebaseClassPath(platform_id, altClassHash);
                        const altImagePath = buildFirebaseImagePath(altClassPath, imageKey);
                        return new Promise((resolve, reject) => {
                          admin.database().ref(altImagePath).once("value")
                            // if found we resolve with the image content
                            .then(snapshot => resolve(snapshot.val()))
                            // if not found we resolve with undefined
                            .catch(e => resolve(undefined));
                        });
                      })).then(altImageDocs => {
                        // If we get here then all of the promises resolved, presumably one of them
                        // to the image contents and the others to undefined.
                        let foundImageDoc: any = imageDoc;
                        altImageDocs.forEach((altImageDoc, altImageDocIndex) => {
                          if (altImageDoc) {
                            const altClassHash = classes?.[altImageDocIndex];
                            console.log("Found missing image", imageKey, "for support", supportKey,
                                        "in class", altClassHash, "instead of class", classHash);
                            foundImageDoc = altImageDoc;
                            _url && altClassHash && (supportImageResolutions[supportKey][_url] = altClassHash);
                            imageKey && platform_id && altClassHash && !firestoreImages[imageKey] &&
                              (firestoreImages[imageKey] = {
                                url: legacyUrl,
                                classPath: _classPath,
                                platform_id,
                                context_id: altClassHash
                              });
                            ++displacedImages;
                          }
                        });
                        if (!foundImageDoc) {
                          console.log("Never found missing image", imageKey,
                                      "for support", supportKey, "from class", classHash);
                        }
                        // resolve the imageDoc promise with the found image contents (or undefined)
                        resolve(foundImageDoc);
                      });
                    }
                  });
                })).then(() => {
                  // resolve the support document promise once all of the image promises have resolved
                  resolve(doc);
                  displacedImages && ++supportsWithDisplacedImages;
                  console.log("Resolved", ++resolvedDocuments, "of", docRefs.length, "supports",
                              `(${supportKey}, ${classHash}) with ${imageDocs.length} images.`);
                });
              });
            }
            else {
              // resolve the support document promise without checking images
              resolve(doc);
              console.log("Resolved", ++resolvedDocuments, "of", docRefs.length, "supports",
                          `(${supportKey}, ${classHash}) without checking images.`);
            }
          }
          else {
            // resolve the support document promise for supports without any images
            resolve(doc);
            console.log("Resolved", ++resolvedDocuments, "of", docRefs.length, "supports",
                        `(${supportKey}, ${classHash}) with no images.`);
          }
        });
    })));
    // All support promises have been resolved. Process the results
    docs.forEach(async (doc, docIndex) => {
      // for each support document...
      const docRef = docRefs[docIndex];
      const path = docRef.path;
      const parts = path.split('/');
      const supportKey = parts[parts.length - 1];
      const docData: IFirestoreMultiClassSupport | undefined = (doc as any)?.data() as any;
      const {
        appMode, platform_id = "", uid, context_id: classHash,
        classPath: docClassPath, content, originDoc, properties = {}
      } = docData || {};
      // identify image-supporting tiles in this support document
      const imageTileMatches = [...(content?.matchAll(kImageTileRegex) || [])];
      if (imageTileMatches.length) {
        ++supportsWithImageTiles;
        totalImageTileCount += imageTileMatches.length;
      }
      // for each active url reference in this support document, track down the location of the image data
      const activeImages = activeImagesMap[supportKey];
      if (activeImages.length) {
        totalImageUrlCount += activeImages.length;
        if (shouldCheckImageContents(docIndex, classHash, supportKey)) {
          let foundCount = 0;
          let foundInOtherClass = 0;
          activeImages.forEach(({ url }) => {
            if (url && supportImageResolutions[supportKey][url]) {
              ++foundCount;
              if (supportImageResolutions[supportKey][url] !== classHash) {
                ++foundInOtherClass;
              }
            }
          });
          // note any supports with images that were never found
          const missing = activeImages.length - foundCount;
          if (missing) {
            ++supportsWithMissingImages;
            const isDeleted = properties.isDeleted === "true";
            const isTowleJones = ((uid === "533058") || (uid === "533059"));
            console.log("Support", supportKey, "isDeleted:", isDeleted, "originDoc:", originDoc,
                        `(Towle/Jones: ${isTowleJones})`, "has", missing, "missing images!");
          }
          // note any supports with images that were found in unexpected classes
          if (foundInOtherClass) {
            const isDeleted = properties.isDeleted === "true";
            const isTowleJones = ((uid === "533058") || (uid === "533059"));
            console.log("Support", supportKey, "isDeleted:", isDeleted, "originDoc:", originDoc,
                        `(Towle/Jones: ${isTowleJones})`, "has", foundInOtherClass, "displaced images!");
          }
          // generate the list of `mcimages` entries required by this support
          multiClassImagesMap[supportKey] = activeImages.map(({ url, legacyUrl, key }) => {
            const { classes = [], resource_link_id = "", resource_url = "" } = docData || {};
            const { classPath, context_id } = firestoreImages[key];
            return {
              url: legacyUrl, classes, classPath, supportKey, platform_id, context_id, resource_link_id, resource_url
            };
          });
        }
      }
      // track the number of unique origin documents from which supports have been published
      originDoc && originDocs.add(originDoc);
      if ((appMode == null) || (docClassPath == null)) {
        ++invalidMetadataCount;
      }
      // track the number of deleted support documents
      if (properties.isDeleted === "true") {
        ++deletedCount;
      }
      // track the number of supports authored by Towle & Jones, the teachers that stress this feature the most
      if ((uid === "533058") || (uid === "533059")) {
        ++towleJonesCount;
      }
      // log information about individual support if requested
      if (shouldLogIndividualSupports(docIndex, classHash, supportKey)) {
        console.log(supportKey, "classHash:", classHash, "classes:", docData?.classes.length, "originDoc:", originDoc);
        console.log("  appMode:", appMode, "platform_id:", platform_id, "uid:", uid, "classPath:", docClassPath);
        const activeImageUrls = activeImages.map(img => img.url);
        console.log("  imageTiles:", imageTileMatches.length, "imageUrls:", `[${activeImageUrls.join(", ")}]`);
      }
    });
    // log summary statistics about the set of supports processed
    console.log(invalidMetadataCount, "of", docs.length, "supports have incomplete metadata!");
    console.log(deletedCount, "of", docs.length, "supports have been deleted.");
    console.log(originDocs.size, "unique documents have been published as supports.");
    console.log(towleJonesCount, "of", docs.length, "supports are from Towle/Jones.");
    console.log(supportsWithImageTiles, "of", docs.length, "supports contain a total of",
                totalImageTileCount, "image tiles with", totalImageUrlCount, "image urls",
                `(${activeImageUrlCount} active, ${uniqueImageUrls.size} unique).`);
    console.log(supportsWithMissingImages, "of", docs.length, "supports have missing images.");
    console.log(supportsWithDisplacedImages, "of", docs.length,
                "supports have displaced images (found in unexpected classes).");
    console.log("Images per tile type", "Image:", imageCountsPerTileType.Image,
                "Geometry:", imageCountsPerTileType.Geometry, "Drawing:", imageCountsPerTileType.Drawing);
    // write/log the entries to be added to the firestore `images` collection
    let imageIndex = 0;
    await Promise.all(Object.keys(firestoreImages).map(imageKey => {
      const image = firestoreImages[imageKey];
      console.log(`${++imageIndex}: images[${imageKey}]: ${JSON.stringify(image)}`);
      return kDryRun
              ? Promise.resolve()
              : admin.firestore().doc(`${kFirestoreImagesPath}/${imageKey}`).set(image);
    }));
    console.log(`${kDryRun ? "Would have written" : "Wrote"} ${imageIndex} records to 'images' collection`);
    // write/log the entries to be added to the firestore `mcimages` collection
    let mcimageIndex = 0;
    // promise for each support
    await Promise.all(Object.keys(multiClassImagesMap).map(supportKey => {
      // promise for each mcimage within the support
      return Promise.all(multiClassImagesMap[supportKey].map(mcimage => {
        const { imageKey } = parseImageUrl(mcimage.url);
        // compound key includes support key and image key
        const key = `${supportKey}_${imageKey}`;
        console.log(`${++mcimageIndex}: mcimages[${key}]: ${JSON.stringify(mcimage)}`);
        return kDryRun
                ? Promise.resolve()
                : admin.firestore().doc(`${kFirestoreMCImagesPath}/${key}`).set(mcimage);
      }));
    }));
    console.log(`${kDryRun ? "Would have written" : "Wrote"} ${mcimageIndex} records to 'mcimages' collection`);
    process.exit(0);
  });
