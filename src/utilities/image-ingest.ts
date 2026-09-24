import { EntryStatus, gImageMap } from "../models/image-map";

/**
 * The single sanctioned path from a user-supplied image to a value safe to persist in a
 * document. Never returns the entry's `displayUrl`, which is a session-local blob URL that
 * would be dead for every other user.
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
    if (contentUrl && /^(https?:|data:)/.test(contentUrl)) {
      // The external-url handler falls back to the original url when it cannot fetch the
      // image (usually CORS). The value still works, but it stays outside our storage.
      console.warn(`ingestImage: image was not stored in CLUE, using original url: ${contentUrl}`);
    }
    return contentUrl;
  } catch (error) {
    console.warn(`ingestImage: failed to store image: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}
