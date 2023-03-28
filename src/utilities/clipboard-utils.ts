import { gImageMap, ImageMapEntryType } from "../models/image-map";

interface IOnCompleteParams {
  image: ImageMapEntryType;
}
type OnComplete = (params: IOnCompleteParams) => void;

export const pasteClipboardImage = async (imageData: any, onComplete: OnComplete) => {
  if (imageData.image) {
    const blobToFile = new File([imageData.image], "clipboard-image.png");
    gImageMap.addFileImage(blobToFile).then(image => {
      onComplete({ image });
    });
  } else if (imageData.text) {
    const url = imageData.text.match(/curriculum\/([^/]+\/images\/.*)/);
    if (!url) {
      console.error("ERROR: invalid image URL");
      return;
    }
    const fileUrl = url[1];
    const filename = fileUrl.split("/").pop();
    const imageEntry = await gImageMap.getImage(fileUrl, {filename});
    onComplete({ image: imageEntry });
  } else {
    console.error("ERROR: unknown clipboard content type");
  }
};

export const getClipboardContent = async () => {
  const clipboardContent: Record<string, any> = {
    image: null,
    text: null
  };
  if (navigator.clipboard.read) {
    const clipboardContents = await navigator.clipboard.read();
    for (const item of clipboardContents) {
      if (item.types.includes("image/png")) {
        clipboardContent.image = await item.getType("image/png");
      }
      if (item.types.includes("text/plain")) {
        const textBlob = await item.getType("text/plain");
        clipboardContent.text = await textBlob.text();
      }
    }
  }
  return clipboardContent;
};
