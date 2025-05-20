import { gImageMap, ImageMapEntry } from "../models/image-map";

interface IOnCompleteParams {
  image: ImageMapEntry;
}
interface IClipboardContents {
  image: File | null;
  text: string | null;
  types: string[];
}
type OnComplete = (params: IOnCompleteParams) => void;

export const pasteClipboardImage = async (imageData: IClipboardContents, onComplete: OnComplete) => {
  if (imageData.image) {
    gImageMap.addFileImage(imageData.image).then(image => {
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

export const pasteClipboardImage2 = (imageData: IClipboardContents) => {
  if (imageData.image) {
    return gImageMap.addFileImage2(imageData.image);
  } else if (imageData.text) {
    const url = imageData.text.match(/curriculum\/([^/]+\/images\/.*)/);
    if (!url) {
      console.error(`ERROR: invalid image URL: ${imageData.text}`);
      return;
    }
    const fileUrl = url[1];
    const filename = fileUrl.split("/").pop();
    const promise = gImageMap.getImage(fileUrl, {filename});
    const entry = gImageMap.getCachedImage(fileUrl);
    return { promise, entry };
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
          const imageBlob = await item.getType("image/png");
          const blobToFile = new File([imageBlob], "clipboard-image.png");
          clipboardContent.image = blobToFile;
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
