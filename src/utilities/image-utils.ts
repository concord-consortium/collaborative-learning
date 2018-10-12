import { Firebase } from "../lib/firebase";

const ImageConstants = {
  maxWidth: 512,
  maxHeight: 512
};

const imageUrlLookupTable: Map<string, string> = new Map();

export function fetchImageUrl(imagePath: string, firebase: Firebase, callback: any) {
  if (imageUrlLookupTable.get(imagePath)) {
    callback(imageUrlLookupTable.get(imagePath));
  }

  const isFullUrl: RegExp = new RegExp("/^https?://");
  const isFireStorePath: RegExp = new RegExp("/^gs://");

  if (imagePath.match(isFullUrl)) {
    imageUrlLookupTable.set(imagePath, imagePath);
    callback(imageUrlLookupTable.get(imagePath));
  }
  else if (imagePath.match(isFireStorePath)) {
    firebase.getPublicUrlFromStore(imagePath).then((url) => {
      if (url) {
        imageUrlLookupTable.set(imagePath, url);
        callback(url);
      } else {
        callback("assets/image_placeholder.png");
      }
    }).catch(() => {
      callback("assets/image_placeholder.png");
    });
  }
  else {
    callback(imagePath);
  }
}

export function uploadImage(firebase: Firebase, storePath: string, currentFile: File, callback: any) {
  resizeImage(currentFile, ImageConstants.maxWidth, ImageConstants.maxHeight).then((resizedImage: Blob) => {
    firebase.uploadImage(storePath, currentFile, resizedImage).then((uploadRef) => {
      firebase.getPublicUrlFromStore(uploadRef).then((url) => {
        imageUrlLookupTable.set(storePath, url);
        callback(url);
      });
    });
  });
}

export function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = URL.createObjectURL(file);
    image.onload = () => {
      const width = image.width;
      const height = image.height;

      if (width <= maxWidth && height <= maxHeight) {
        resolve(file);
      }

      let newWidth;
      let newHeight;

      if (width > height) {
        newHeight = height * (maxWidth / width);
        newWidth = maxWidth;
      } else {
        newWidth = width * (maxHeight / height);
        newHeight = maxHeight;
      }

      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;

      const context = canvas.getContext("2d");

      context!.drawImage(image, 0, 0, newWidth, newHeight);

      canvas.toBlob(resolve as any, file.type);
    };
    image.onerror = reject;
  });
}

interface ImageDimensions {
  width: number;
  height: number;
}

export function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = URL.createObjectURL(file);
    image.onload = () => {
      const width = image.width;
      const height = image.height;

      resolve({ width, height });
    };
  });
}
