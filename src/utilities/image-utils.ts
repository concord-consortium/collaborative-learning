import { Firebase } from "../lib/firebase";
import { DB } from "../lib/db";
import { ImageModelType } from "../models/image";

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
const ccImageId = "ccimg://";

// Firebase calls with callbacks
export function fetchImageUrl(imagePath: string, db: DB, callback: any) {
  if (imageUrlLookupTable.get(imagePath)) {
    callback(imageUrlLookupTable.get(imagePath));
    return;
  }
  const isCCUrl = imagePath.startsWith(ccImageId);
  const isFullUrl = imagePath.startsWith("http");
  const isLocalFilePath = imagePath.startsWith("assets/");
  const isFirebaseStorageUrl = imagePath.startsWith("https://firebasestorage");
  const placeholderImage = "assets/image_placeholder.png";
  const isImageData = imagePath.startsWith("data:image");
  const imageUrlAsReference = isFirebaseStorageUrl ? imagePath : undefined;

  if (isCCUrl) {
    const imageId = imagePath.replace(ccImageId, "");
    // fetch image from firebase realtime database
    db.getImage(imageId).then(image => {
      callback(image.imageData);
    });
  }
  else if (isFullUrl && !isFirebaseStorageUrl) {
    imageUrlLookupTable.set(imagePath, imagePath);
    callback(imageUrlLookupTable.get(imagePath));
  }
  else if (isLocalFilePath) {
    callback(imagePath);
  }
  else if (isImageData) {
    callback(imagePath);
  }
  else {
    // Pass in the imagePath as the second argument to get the ref to firebase storage by url
    // This is needed if an image of the same name has been uploaded in two different components,
    // since each public URL becomes invalid and a new url generated on upload
    db.firebase.getPublicUrlFromStore(imagePath, imageUrlAsReference).then((url) => {
      imageUrlLookupTable.set(imagePath, url ? url : placeholderImage);
      callback(url ? url : placeholderImage);
    }).catch(() => {
      callback(placeholderImage);
    });
  }
}
export function storeImage(db: DB, image: ImageModelType): Promise<string> {
  return new Promise((resolve) =>
    db.addImage(image).then(dbImage => {
      resolve(dbImage.image.self.imageKey);
    })
  );
}

export function getCCImagePath(imageKey: string) {
  return ccImageId + imageKey;
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

export function importImage(file: File): Promise<any> {
  return resizeImage(file, ImageConstants.maxWidth, ImageConstants.maxHeight);
}

// Image size functions
function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = URL.createObjectURL(file);
    image.onload = () => {
      const width = image.width;
      const height = image.height;

      let newWidth;
      let newHeight;

      if (width <= maxWidth && height <= maxHeight) {
        newWidth = width;
        newHeight = height;
      } else if (width > height) {
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
      // Return Base64 string of image
      resolve(canvas.toDataURL());
    };
    image.onerror = reject;
  });
}

// new Promise-based way to get dimensions
export function getImageDimensions(file?: File, url?: string): Promise<any> {
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
