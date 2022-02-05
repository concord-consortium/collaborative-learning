import { IDocumentContent } from "./shared";
import { matchAll, parseFirebaseImageUrl, replaceAll, safeJsonParse } from "./shared-utils";

// regular expression for identifying firebase image urls in document content
// capture group 1: "url" (Drawing, Image) or "parents" (Geometry)
//                       |-------------------------|
// capture group 2: image url                            |---------------------------------------|
// capture group 3: image key (includes class hash for modern image urls)                 |-----|
const kImageUrlRegex = /(\\"url\\":|\\"parents\\":\[)\\"(ccimg:\/\/fbrtdb\.concord\.org\/([^\\"]+))\\"/g;

interface IImageInfo {
  url: string;
  legacyUrl: string;
  key: string;
}

export async function parseDocumentContent(contentJson: string, canonicalizeUrl: (url: string) => Promise<string>) {

  const content = safeJsonParse<IDocumentContent>(contentJson);

  // find all image-supporting tiles (Drawing, Geometry, Image)
  const imageTiles: Array<{ type: string, content: string }> = [];
  content?.tileMap && Object.keys(content.tileMap).forEach(tileId => {
    const { content: tileContent } = content.tileMap[tileId];
    if (["Drawing", "Geometry", "Image"].indexOf(tileContent.type) >= 0) {
      imageTiles.push({ type: tileContent.type, content: JSON.stringify(tileContent) });
    }
  });

  const activeImages: IImageInfo[] = [];

  // find all the firebase image urls in the support content
  imageTiles.forEach(({ type: tileType, content: tileContent }) => {
    const imageMatches = matchAll(kImageUrlRegex, tileContent)
                          .map(match => {
                            const [ , , url, path] = match;
                            const { imageKey: key = path, legacyUrl } = parseFirebaseImageUrl(url);
                            return { url, legacyUrl, key };
                          });
    if (imageMatches.length) {
      // Drawing tiles support multiple images so all can be active.
      // Note that this doesn't account for image objects that may have been subsequently deleted,
      // so the image will continue to be shared after all objects that display it have been deleted.
      // Handling this case would require more detailed parsing of Drawing content.
      if (tileType === "Drawing") {
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
