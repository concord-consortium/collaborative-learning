import { Firebase } from "../lib/firebase";
import { DB } from "../lib/db";
import { ImageModelType, ImageModel } from "../models/image";

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
const placeholderImage = "assets/image_placeholder.png";

const URLTypes = {cc: 0, external: 1, local: 3, fbStorageUrl: 4, fbStoragePath: 5, invalid: 6};

function getUrlType(imagePath: string) {
  let urlType = URLTypes.cc;
  const isCCUrl = imagePath.startsWith(ccImageId);
  const isFullUrl = imagePath.startsWith("http");
  const isLocalFilePath = imagePath.startsWith("assets/");
  const isFirebaseStorageUrl = imagePath.startsWith("https://firebasestorage");
  const isImageData = imagePath.startsWith("data:image");

  if (!imagePath) {
    urlType = URLTypes.invalid;
  }
  else if (isCCUrl) {
    urlType = URLTypes.cc;
  }
  else if (isFullUrl && !isFirebaseStorageUrl) {
    urlType = URLTypes.external;
  }
  else if (isLocalFilePath || isImageData) {
    urlType = URLTypes.local;
  }
  else if (isFirebaseStorageUrl) {
    urlType = URLTypes.fbStorageUrl;
  }
  else {
    urlType = URLTypes.fbStoragePath;
  }
  return urlType;
}

// Firebase calls with promise
export function fetchImageUrl(imagePath: string, db: DB): Promise<any> {
  const urlType = getUrlType(imagePath);

  return new Promise((resolve) => {

    if (imageUrlLookupTable.get(imagePath)) {
      resolve(imageUrlLookupTable.get(imagePath));
      return;
    }

    switch (urlType) {
      case URLTypes.invalid:
        resolve(placeholderImage);
        break;

      case URLTypes.cc:
        const imageId = imagePath.replace(ccImageId, "");
        // fetch image from firebase realtime database
        db.getImage(imageId).then(image => {
          resolve(image.imageData);
        });
        break;

      case URLTypes.external:
        imageUrlLookupTable.set(imagePath, imagePath);
        resolve(imageUrlLookupTable.get(imagePath));
        break;

      case URLTypes.local:
        resolve(imagePath);
        break;

      case URLTypes.fbStorageUrl || URLTypes.fbStoragePath:
        const imageUrlAsReference = urlType === URLTypes.fbStorageUrl ? imagePath : undefined;
        // Pass in the imagePath as the second argument to get the ref to firebase storage by url
        // This is needed if an image of the same name has been uploaded in two different components,
        // since each public URL becomes invalid and a new url generated on upload
        db.firebase.getPublicUrlFromStore(imagePath, imageUrlAsReference).then(url => {
          if (url) {
            resizeImage(url, ImageConstants.maxWidth, ImageConstants.maxHeight).then(imageData => {
              const image: ImageModelType = ImageModel.create({
                key: "",
                imageData,
                title: "Placeholder",
                originalSource: imagePath,
                createdAt: 0,
                createdBy: ""
              });
              storeImage(db, image).then(imageKey => {
                if (imageKey) {
                  imageUrlLookupTable.set(imagePath, getCCImagePath(imageKey));
                  db.getImage(imageKey).then(dbImage => {
                    resolve({ imageData: dbImage.imageData, newUrl: getCCImagePath(imageKey) });
                  });
                }
                resolve(placeholderImage);
              });
            }).catch(() => {
              resolve(placeholderImage);
            });
          } else {
            resolve(placeholderImage);
          }
        });
        break;

      default:
        resolve(placeholderImage);
    }
  });
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

export function importImage(file: File): Promise<any> {
  const imageUrl = URL.createObjectURL(file);
  return resizeImage(imageUrl, ImageConstants.maxWidth, ImageConstants.maxHeight);
}

// Image size functions
function resizeImage(imageUrl: string, maxWidth: number, maxHeight: number): Promise<string> {
  console.log(imageUrl);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageUrl;
    image.crossOrigin = "anonymous";
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
