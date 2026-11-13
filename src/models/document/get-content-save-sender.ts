import { ConcurrentContentSaveSender } from "./concurrent-content-save-sender";
import { ContentSaveSender, IContentSaveSenderOptions } from "./content-save-sender";
import { DocumentModelType } from "./document";
import { IndividualContentSaveSender } from "./individual-content-save-sender";

// One sender for each document.
const senders = new WeakMap<DocumentModelType, ContentSaveSender>();

/**
 * The document's sender, so a document has one writer however often it is attached. A sender that
 * is still saving after it was detached is attached again, and a disposed one is replaced.
 */
export function getContentSaveSender(document: DocumentModelType, options: IContentSaveSenderOptions) {
  const existing = senders.get(document);
  if (existing) {
    existing.attach(options);
    return existing;
  }
  const forget = () => {
    if (senders.get(document) === sender) {
      senders.delete(document);
    }
  };
  const sender: ContentSaveSender = document.concurrent
    ? new ConcurrentContentSaveSender(document, options, forget)
    : new IndividualContentSaveSender(document, options, forget);
  sender.start();
  senders.set(document, sender);
  return sender;
}
