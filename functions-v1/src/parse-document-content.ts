import { IDocumentContent } from "../../shared/shared";
import { matchAll, parseFirebaseImageUrl, replaceAll, safeJsonParse } from "../../shared/shared-utils";

// regular expression for identifying firebase image urls in document content
// In some tile state the image URLS are inside of a double escaped JSON. This means
// they will be in a string like \"url\" because the quotes have to be escaped.
// This is why in the regex below the URL is terminated either by \\" or "
//
// capture group 1: image url
//                        |---------------------------------------|
// capture group 2: image key (includes class hash for modern image urls)
//                                                         |-----|
const kImageUrlRegex = /"(ccimg:\/\/fbrtdb\.concord\.org\/([^\\"]+))\\?"/g;

interface IImageInfo {
  url: string;
  legacyUrl: string;
  key: string;
}

export async function parseDocumentContent(contentJson: string, canonicalizeUrl: (url: string) => Promise<string>) {

  const content = safeJsonParse<IDocumentContent>(contentJson);

  // find all image-supporting tiles (Drawing, Geometry, Image)
  const imageTilesOrSharedModels: Array<{ type: string, content: string }> = [];
  content?.tileMap && Object.keys(content.tileMap).forEach(tileId => {
    const { content: tileContent } = content.tileMap[tileId];
    if (["Drawing", "Geometry", "Image"].indexOf(tileContent.type) >= 0) {
      imageTilesOrSharedModels.push({ type: `tile:${tileContent.type}`, content: JSON.stringify(tileContent) });
    }
  });
  content?.sharedModelMap && Object.keys(content.sharedModelMap).forEach(sharedModelId => {
    const { sharedModel } = content.sharedModelMap[sharedModelId];
    if (["SharedDataSet"].indexOf(sharedModel.type) >= 0) {
      imageTilesOrSharedModels.push({type: `sharedModel:${sharedModel.type}`, content: JSON.stringify(sharedModel) });
    }
  });

  const activeImages: IImageInfo[] = [];

  // find all the firebase image urls in the support content
  imageTilesOrSharedModels.forEach(({ type: itemType, content: itemContent }) => {
    const imageMatches = matchAll(kImageUrlRegex, itemContent)
                          .map(match => {
                            const [ , url, path] = match;
                            const { imageKey: key = path, legacyUrl } = parseFirebaseImageUrl(url);
                            return { url, legacyUrl, key };
                          });
    if (imageMatches.length) {
      // Drawing tiles support multiple images so all can be active.
      // Note that this doesn't account for image objects that may have been subsequently deleted,
      // so the image will continue to be shared after all objects that display it have been deleted.
      // Handling this case would require more detailed parsing of Drawing content.
      // SharedDataSet sharedModels also support multiple images
      if (itemType === "tile:Drawing" || itemType === "sharedModel:SharedDataSet") {
        activeImages.push(...imageMatches);
      }
      else {
        // Geometry and Image tiles only support a single image, so only the last is active
        activeImages.push(imageMatches[imageMatches.length - 1]);
      }
    }
  });

  // map from legacy url to canonical url
  const uniqueImages: Record<string, string> = {};
  const canonicalUrls = await Promise.all(activeImages.map(image => canonicalizeUrl(image.url)));
  activeImages.forEach(async (image, i) => {
    if (!uniqueImages[image.legacyUrl]) {
      uniqueImages[image.legacyUrl] = canonicalUrls[i];
    }
  });

  // canonicalize the url references in the content
  let canonicalizedJson = contentJson;
  for (const legacyUrl in uniqueImages) {
    canonicalizedJson = replaceAll(canonicalizedJson, legacyUrl, uniqueImages[legacyUrl]);
  }

  return { content: canonicalizedJson, images: uniqueImages };
}
