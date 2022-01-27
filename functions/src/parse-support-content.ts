import { parseFirebaseImageUrl } from "./shared";
import { matchAll, replaceAll } from "./shared-utils";

// regular expression for identifying tiles that can reference images in document content
const kImageTileRegex = /"type":"(Drawing|Geometry|Image)"/g;

// regular expression for identifying firebase image urls in document content
// capture group 1: "url" (Drawing, Image) or "parents" (Geometry)
//                       |-------------------------|
// capture group 2: image url                            |---------------------------------------|
// capture group 3: image key (includes class hash for modern image urls)                 |-----|
const kImageUrlRegex = /(\\"url\\":|\\"parents\\":\[)\\"(ccimg:\/\/fbrtdb\.concord\.org\/([^\\"]+))\\"/g;

export async function parseSupportContent(content: string, canonicalizeUrl: (url: string) => Promise<string>) {

  // find all image-supporting tiles (Drawing, Geometry, Image)
  const imageTileMatches = matchAll(kImageTileRegex, content)
                            .map(match => {
                              const [ , tileType] = match;
                              const { index: start = 0 } = match;
                              return { tileType, start };
                            });

  // return the index of the tile containing the url reference
  const getTileIndex = (urlStart: number) => imageTileMatches.findIndex((tileMatch, i) => {
    const thisMatch = tileMatch.start < urlStart;
    const nextMatch = (i < imageTileMatches.length - 1) && ((imageTileMatches[i + 1].start < urlStart));
    return thisMatch && !nextMatch;
  });

  // find all the firebase image urls in the support content
  const imageMatches = matchAll(kImageUrlRegex, content)
                        .map(match => {
                          const [ , , url, path] = match;
                          const { imageKey: key = path, legacyUrl } = parseFirebaseImageUrl(url);
                          const { index: start = 0 } = match;
                          const tileIndex = getTileIndex(start);
                          const tileType = imageTileMatches[tileIndex].tileType;
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

  // map from legacy url to canonical url
  const uniqueImages: Record<string, string> = {};
  const canonicalUrls = await Promise.all(activeImages.map(image => canonicalizeUrl(image.url)));
  activeImages.forEach(async (image, i) => {
    if (!uniqueImages[image.legacyUrl]) {
      uniqueImages[image.legacyUrl] = canonicalUrls[i];
    }
  });

  // canonicalize the url references in the content
  let canonicalizedContent = content;
  for (const legacyUrl in uniqueImages) {
    canonicalizedContent = replaceAll(canonicalizedContent, legacyUrl, uniqueImages[legacyUrl]);
  }

  return { content: canonicalizedContent, images: uniqueImages };
}
