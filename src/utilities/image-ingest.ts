import { EntryStatus, gImageMap } from "../models/image-map";

const kCcImgPrefix = "ccimg://";

/**
 * The single sanctioned path from a user-supplied image to a value safe to persist in a
 * document. Both arms resize the image and push it to class-scoped storage, returning a
 * `ccimg://` reference. Never returns the entry's `displayUrl`, which is a session-local
 * blob URL that would be dead for every other user.
 *
 * Returns undefined if the image could not be stored.
 */
export async function ingestImage(source: File | string): Promise<string | undefined> {
  const entry = source instanceof File
    ? await gImageMap.addFileImage(source)
    : await gImageMap.getImage(source);

  if (entry.status === EntryStatus.Error) return undefined;

  const { contentUrl } = entry;
  if (contentUrl && !contentUrl.startsWith(kCcImgPrefix)) {
    // The external-url handler falls back to the original url when it cannot fetch the
    // image (usually CORS). The value still works, but it stays outside our storage.
    console.warn(`ingestImage: image was not stored in CLUE, using original url: ${contentUrl}`);
  }
  return contentUrl;
}
