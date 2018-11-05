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
export interface ISimpleImage {
  imageKey?: string;
  imageUrl: string;
  imageData?: string;
}

const imageLookupTable: Map<string, ISimpleImage> = new Map();
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
export function getImage(imagePath: string, db: DB, userId: string): Promise<ISimpleImage> {
  const urlType = getUrlType(imagePath);
  const lookupImage = imageLookupTable.get(imagePath);
  const img: ISimpleImage = {
    imageUrl: placeholderImage
  };
  return new Promise((resolve) => {

    if (lookupImage) {
      resolve(lookupImage);
      return;
    }

    switch (urlType) {
      case URLTypes.invalid:
        resolve(img);
        break;

      case URLTypes.cc:
        const imageId = imagePath.replace(ccImageId, "");
        // fetch image from firebase realtime database
        db.getImage(imageId).then(image => {
          img.imageData = image.imageData;
          // url returned as-is
          img.imageUrl = imagePath;
          imageLookupTable.set(imagePath, img);
          resolve(img);
        });
        break;

      case URLTypes.external:
        // upload images from external urls to our own firebase if possible
        // this may fail depending on CORS settings on target image.
        storeImage(db, userId, undefined, imagePath).then(simpleImage => {
          imageLookupTable.set(simpleImage.imageUrl, simpleImage);
          resolve(simpleImage);
        }).catch(() => {
          // If the silent upload has failed, do we retain the full url or
          // encourage the user to download a copy and re-upload?
          // For now, return a placeholder.
          resolve(img);
        });
        break;

      case URLTypes.local:
        // Allow assets/images in authoring documents to be linked directly
        img.imageUrl = imagePath;
        imageLookupTable.set(imagePath, img);
        resolve(img);
        break;

      case URLTypes.fbStorageUrl || URLTypes.fbStoragePath:
        // All images from firebase storage must be migrated to realtime database
        const imageUrlAsReference = urlType === URLTypes.fbStorageUrl ? imagePath : undefined;
        // Pass in the imagePath as the second argument to get the ref to firebase storage by url
        // This is needed if an image of the same name has been uploaded in two different components,
        // since each public URL becomes invalid and a new url generated on upload
        db.firebase.getPublicUrlFromStore(imagePath, imageUrlAsReference).then(url => {
          if (url) {
            storeImage(db, userId, undefined, imagePath).then(simpleImage => {
              imageLookupTable.set(simpleImage.imageUrl, simpleImage);
              // Image has been retrieved from Storage, now we can safely remove the old image
              // TODO: remove old images
              resolve(simpleImage);
            }).catch(() => {
              resolve(img);
            });
          } else {
            resolve(img);
          }
        });
        break;

      default:
        resolve(img);
    }
  });
}

function kUploadImage(db: DB, image: ImageModelType): Promise<ISimpleImage> {
  const img: ISimpleImage = {
    imageUrl: placeholderImage
  };

  return new Promise((resolve, reject) =>
    db.addImage(image).then(dbImage => {
      img.imageKey = dbImage.image.self.imageKey;
      img.imageData = dbImage.image.imageData;
      img.imageUrl = getCCImagePath(dbImage.image.self.imageKey);
      resolve(img);
    }).catch(() => {
      reject();
    })
  );
}

export function getCCImagePath(imageKey: string) {
  return ccImageId + imageKey;
}

export function storeImage(db: DB, userId: string, file?: File, imagePath?: string): Promise<ISimpleImage> {
  const img: ISimpleImage = {
    imageUrl: placeholderImage
  };

  return new Promise((resolve, reject) => {
    const imageUrl = file ? URL.createObjectURL(file) : imagePath ? imagePath : undefined;
    const imageName = file ? file.name : imagePath;
    if (!imageUrl) reject(img);

    resizeImage(imageUrl!, ImageConstants.maxWidth, ImageConstants.maxHeight).then(imageData => {
      const image: ImageModelType = ImageModel.create({
        key: "",
        imageData,
        title: imageName,
        originalSource: imageName,
        createdAt: 0,
        createdBy: userId
      });
      kUploadImage(db, image).then(storedImage => {
        resolve(storedImage);
      }).catch(() => {
        resolve(img);
      });
    });
  });
}

// Image size functions
function resizeImage(imageUrl: string, maxWidth: number, maxHeight: number): Promise<string> {
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

export function getImageDimensions(file?: File, url?: string): Promise<any> {
  const image = new Image();
  if (file) {
    image.src = URL.createObjectURL(file);
  } else {
    image.src = url!;
  }
  return new Promise((resolve) => {
    image.onload = () => {
      const width = image.width;
      const height = image.height;
      imageDimensionsLookupTable.set(image.src, { width, height });
      resolve({ width, height, src: image.src });
    };
  });
}
