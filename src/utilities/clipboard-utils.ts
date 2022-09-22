import { gImageMap} from "../models/image-map";
type OnComplete = (params: File | string) => void;

export const pasteClipboardImage = async (callback: OnComplete, mode: string) => { //mode either "file" or "url"
  const clipboardContents = await navigator.clipboard.read();
  if (clipboardContents.length > 0) {
    if (clipboardContents[0].types.includes("image/png")) {
      clipboardContents[0].getType("image/png").then(blob => {
        const blobToFile = new File([blob], "clipboard-image");
        gImageMap.addFileImage(blobToFile).then(image => {
            if (mode === "url"){ //for drawing tile (Func comp) - will invoke setState with the url string
              callback(image.contentUrl || '');
            }
            if (mode === "file"){ //for image tile (Class comp) - will invoke this.handleUploadImageFile with new File
              callback(blobToFile);
            }
        });
      });
    }
  }
};
