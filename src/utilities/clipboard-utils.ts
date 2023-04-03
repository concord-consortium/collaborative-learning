import { gImageMap, ImageMapEntryType } from "../models/image-map";

interface IOnCompleteParams {
  image: ImageMapEntryType;
}
interface IClipboardContents {
  image: Blob | null;
  text: string | null;
  types: string[];
}
type OnComplete = (params: IOnCompleteParams) => void;

export const pasteClipboardImage = async (imageData: IClipboardContents, onComplete: OnComplete) => {
  if (imageData.image) {
    const blobToFile = new File([imageData.image], "clipboard-image.png");
    gImageMap.addFileImage(blobToFile).then(image => {
      onComplete({ image });
    });
  } else if (imageData.text) {
    const url = imageData.text.match(/curriculum\/([^/]+\/images\/.*)/);
    if (!url) {
      console.error(`ERROR: invalid image URL: ${imageData.text}`);
      return;
    }
    const fileUrl = url[1];
    const filename = fileUrl.split("/").pop();
    const imageEntry = await gImageMap.getImage(fileUrl, {filename});
    onComplete({ image: imageEntry });
  } else {
    console.error(`ERROR: unknown clipboard content type(s): ${imageData.types}`);
  }
};

export const getClipboardContent = async (clipboardData?: DataTransfer) => {
  const clipboardContent: IClipboardContents = {
    image: null,
    text: null,
    types: []
  };

  if (clipboardData) {
    for (const item of clipboardData.items) {
      if (item.type === "image/png") {
        clipboardContent.image = item.getAsFile();
      }
      if (item.type === "text/plain") {
        clipboardContent.text = clipboardData.getData("text/plain");
      }
    }
  } else {
    if (navigator.clipboard.read) {
      const clipboardContents = await navigator.clipboard.read();
      for (const item of clipboardContents) {
        clipboardContent.types.push(...item.types);
        if (item.types.includes("image/png")) {
          clipboardContent.image = await item.getType("image/png");
        }
        if (item.types.includes("text/plain")) {
          const textBlob = await item.getType("text/plain");
          clipboardContent.text = await textBlob.text();
        }
      }
    }
  }

  return clipboardContent;
};
