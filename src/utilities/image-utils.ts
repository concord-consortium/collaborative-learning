import { Firebase } from "../lib/firebase";

const ImageConstants = {
  maxWidth: 512,
  maxHeight: 512
};
interface ImageDimensions {
  width: number;
  height: number;
  src?: string;
}

const imageUrlLookupTable: Map<string, string> = new Map();
const imageDimensionsLookupTable: Map<string, ImageDimensions> = new Map();

// Firebase calls with callbacks
export function fetchImageUrl(imagePath: string, firebase: Firebase, callback: any) {
  if (imageUrlLookupTable.get(imagePath)) {
    callback(imageUrlLookupTable.get(imagePath));
    return;
  }

  const isFullUrl = imagePath.startsWith("http");
  const isLocalFilePath = imagePath.startsWith("assets/");
  const isFirebaseStorageUrl = imagePath.startsWith("https://firebasestorage");
  const placeholderImage = "assets/image_placeholder.png";
  const imageUrlAsReference = isFirebaseStorageUrl ? imagePath : undefined;

  if (isFullUrl && !isFirebaseStorageUrl) {
    imageUrlLookupTable.set(imagePath, imagePath);
    callback(imageUrlLookupTable.get(imagePath));
  }
  else if (isLocalFilePath) {
    callback(imagePath);
  }
  else {
    // Pass in the imagePath as the second argument to get the ref to firebase by url
    // This is needed if an image of the same name has been uploaded in two different components,
    // since each public URL becomes invalid and a new url generated on upload
    firebase.getPublicUrlFromStore(imagePath, imageUrlAsReference).then((url) => {
      imageUrlLookupTable.set(imagePath, url ? url : placeholderImage);
      callback(url ? url : placeholderImage);
    }).catch(() => {
      callback(placeholderImage);
    });
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

// Image size functions
function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<Blob> {
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

      imageDimensionsLookupTable.set(image.src, { width: newWidth, height: newHeight });

      const context = canvas.getContext("2d");

      context!.drawImage(image, 0, 0, newWidth, newHeight);
      canvas.toBlob(resolve as any, file.type);
    };
    image.onerror = reject;
  });
}

export function getImageDimensions(callback: any, file?: File, url?: string) {
    const image = new Image();
    image.onload = () => {
      const width = image.width;
      const height = image.height;
      imageDimensionsLookupTable.set(image.src, { width, height });
      callback({ width, height, src: image.src });
    };

    if (file) {
      image.src = URL.createObjectURL(file);
    } else {
      image.src = url!;
    }
}

// new Promise-based way to get dimensions
export function getDimensions(file?: File, url?: string): Promise<any> {
  const image = new Image();
  if (file) {
    image.src = URL.createObjectURL(file);
  } else {
    image.src = url!;
  }
  return new Promise((resolve, reject) => {
    image.onload = () => {
      const width = image.width;
      const height = image.height;
      imageDimensionsLookupTable.set(image.src, { width, height });
      resolve({ width, height, src: image.src });
    };
  });
}
