import { gImageMap, ImageMapEntryType } from "../models/image-map";

interface IOnCompleteParams {
  image: ImageMapEntryType;
}
type OnComplete = (params: IOnCompleteParams) => void;

export const pasteClipboardImage = async (onComplete: OnComplete) => {
  const clipboardContents = await navigator.clipboard.read();
  if (clipboardContents.length > 0) {
    switch (clipboardContents[0].types[0]) {
      case "image/png": {
        clipboardContents[0].getType("image/png").then(blob => {
          const blobToFile = new File([blob], "clipboard-image.png");
          gImageMap.addFileImage(blobToFile).then(image => {
            onComplete({ image });
          });
        });
        break;
      }
      case "text/plain": {
        const textBlob = await clipboardContents[0].getType("text/plain");
        const text = await textBlob.text();
        const url = text.match(/curriculum\/([^/]+\/images\/.*)/);
        if (!url) {
          console.error("ERROR: invalid image URL");
          break;
        }
        const fileUrl = url[1];
        const filename = fileUrl.split("/").pop();
        const imageEntry = await gImageMap.getImage(fileUrl, {filename});
        onComplete({ image: imageEntry });
        break;
      }
      default: {
        console.error("ERROR: unknown clipboard content type");
      }
    }
  }
};
