import { EntryStatus, gImageMap } from "../models/image-map";
import { getClipboardContent } from "./clipboard-utils";

/**
 * The single sanctioned path from a user-supplied image to a value safe to persist in a
 * document. Never returns the entry's `displayUrl`, which is a session-local blob URL that
 * would be dead for every other user.
 *
 * The result is usually a durable `ccimg://` reference. But when storage is unavailable
 * (CORS failure, or no logged-in user), the external-url handler falls back to returning
 * the original url: an http(s) url is small and still renders, so it is passed through with
 * a warning; a `data:` url is neither small nor a durable reference, so it is discarded.
 *
 * Returns undefined if the image could not be stored.
 */
export async function ingestImage(source: File | string): Promise<string | undefined> {
  try {
    const entry = source instanceof File
      ? await gImageMap.addFileImage(source)
      : await gImageMap.getImage(source);

    if (entry.status === EntryStatus.Error) return undefined;

    const { contentUrl } = entry;
    if (contentUrl && /^data:/.test(contentUrl)) {
      console.warn(`ingestImage: dropping unstored data: url (${contentUrl.length} chars) to avoid a bloated document`);
      return undefined;
    }
    if (contentUrl && /^https?:/.test(contentUrl)) {
      console.warn(`ingestImage: image was not stored in CLUE, using original url: ${contentUrl}`);
    }
    return contentUrl;
  } catch (error) {
    console.warn(`ingestImage: failed to store image: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

// Shared by clipboardHasImage() and ingestClipboardImage() so the "is this an image url"
// check is computed by one piece of logic, not duplicated between them.
function analyzeClipboard(clipboardData: DataTransfer) {
  const hasImage = Array.from(clipboardData.items).some(item => item.type === "image/png");
  const text = clipboardData.getData("text/plain");
  const isImageUrlText = !hasImage && !!text && gImageMap.isImageUrl(text);
  return { hasImage, isImageUrlText };
}

/**
 * True when a paste event carries an image, decided synchronously so the caller can
 * suppress the browser's default paste before awaiting the ingest.
 */
export function clipboardHasImage(clipboardData: DataTransfer): boolean {
  const { hasImage, isImageUrlText } = analyzeClipboard(clipboardData);
  return hasImage || isImageUrlText;
}

/**
 * Stores the image a paste event carries and resolves to a value safe to persist,
 * or undefined if there was none or it could not be stored.
 * Callers should check clipboardHasImage() first and call preventDefault() synchronously.
 */
export async function ingestClipboardImage(clipboardData: DataTransfer): Promise<string | undefined> {
  const { hasImage, isImageUrlText } = analyzeClipboard(clipboardData);
  if (!hasImage && !isImageUrlText) return undefined;

  const contents = await getClipboardContent(clipboardData);
  const source = contents.image ?? (isImageUrlText ? contents.text : undefined);
  if (!source) return undefined;

  return ingestImage(source);
}
