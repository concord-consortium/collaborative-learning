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

export const getClipboardContent = async (clipboardData?: DataTransfer) => {
  const clipboardContent: IClipboardContents = {
    image: null,
    text: null,
    types: []
  };

  if (clipboardData) {
    for (const item of clipboardData.items) {
      // Any image type, not just png: pasting a file from the OS keeps its own mime type, and
      // uploads already accept jpeg.
      if (item.type.startsWith("image/")) {
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
        const imageType = item.types.find(type => type.startsWith("image/"));
        if (imageType) {
          const imageBlob = await item.getType(imageType);
          const extension = imageType.split("/")[1] || "png";
          clipboardContent.image = new File([imageBlob], `clipboard-image.${extension}`);
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
