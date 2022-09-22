import { gImageMap, ImageMapEntryType } from "../models/image-map";

interface IOnCompleteParams {
  file: File;
  image: ImageMapEntryType;
}
type OnComplete = (params: IOnCompleteParams) => void;

export const pasteClipboardImage = async (onComplete: OnComplete) => {
  const clipboardContents = await navigator.clipboard.read();
  if (clipboardContents.length > 0) {
    if (clipboardContents[0].types.includes("image/png")) {
      clipboardContents[0].getType("image/png").then(blob => {
        const blobToFile = new File([blob], "clipboard-image");
        gImageMap.addFileImage(blobToFile).then(image => {
          onComplete({ file: blobToFile, image });
        });
      });
    }
  }
};
