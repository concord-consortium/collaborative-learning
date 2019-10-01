import { DocumentDragKey } from "../../models/document/document";

export interface ExternalImageDragDropOptions {
  isAcceptableImageDrag?: (e: React.DragEvent<HTMLDivElement>) => boolean;
}

export class ImageDragDrop {
  private options: ExternalImageDragDropOptions;

  constructor(options: ExternalImageDragDropOptions) {
    this.options = options;
  }

  public dragOver(e: React.DragEvent<HTMLDivElement>) {
    const isAcceptableDrag = this.checkForAcceptableImageDrag(e);
    if (isAcceptableDrag) {
      e.dataTransfer.dropEffect = "copy";
      e.preventDefault();
      return true;
    }
    return false;
  }

  public drop(e: React.DragEvent<HTMLDivElement>) {
    return new Promise<string>((resolve, reject) => {
      if (this.checkForAcceptableImageDrag(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (this.hasUriList(e)) {
          const uriList = e.dataTransfer.getData("text/uri-list");
          const uriArray = uriList && uriList.split(/[\r\n]+/);
          const dropUrl = uriArray && uriArray[0];
          if (dropUrl) {
            resolve(dropUrl);
          } else {
            reject("No url found for dropped image");
          }
        } else if (this.hasFileList(e)) {
          const file = e.dataTransfer.files[0];
          if (file) {
            if (/^image\//.test(file.type)) {
              const reader = new FileReader();
              reader.onload = (readerEvent) => {
                const dropUrl = readerEvent.target && readerEvent.target.result;
                if (dropUrl) {
                  resolve(dropUrl.toString());
                } else {
                  reject("No url found for dropped image file");
                }
              };
              reader.onerror = () => {
                reject("Unable to read dropped image file");
                reader.abort();
              };
              reader.readAsDataURL(file);
            }
            else {
              reject("Only image files are allowed to be dropped");
            }
          } else {
            reject("No file found for dropped image");
          }
        }
      }
      else {
        const isInternalDrag = !!e.dataTransfer.types.find((type) => /org\.concord\.clue\./.test(DocumentDragKey));
        if (!isInternalDrag) {
          reject("Only images are allowed to be dropped");
        }
      }
    });
  }

  private checkForAcceptableImageDrag(e: React.DragEvent<HTMLDivElement>) {
    const acceptableByClient = !this.options.isAcceptableImageDrag || this.options.isAcceptableImageDrag(e);
    return (this.hasUriList(e) || this.hasFileList(e)) && acceptableByClient;
  }

  private hasUriList(e: React.DragEvent<HTMLDivElement>) {
    return e.dataTransfer.types.indexOf("text/uri-list") >= 0;
  }

  private hasFileList(e: React.DragEvent<HTMLDivElement>) {
    return e.dataTransfer.types.indexOf("Files") >= 0;
  }
}
