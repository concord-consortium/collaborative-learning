import { DB } from "../lib/db";
import { ImageModelType, ImageModel } from "../models/image";
import { ImageContentSnapshotOutType } from "../models/tools/image/image-content";
import { safeJsonParse } from "./js-utils";
const placeholderImage = require("../assets/image_placeholder.png");

const ImageConstants = {
  maxWidth: 512,
  maxHeight: 512
};

export interface IImageDimensions {
  src: string;
  width: number;
  height: number;
}

export interface ISimpleImage {
  imageKey?: string;
  imageUrl: string;
  imageData?: string;
}

const ccImageId = "ccimg://";

export function getUrlFromImageContent(content: ImageContentSnapshotOutType) {
  const changes = content.changes;
  for (let i = changes.length - 1; i >= 0; --i) {
    const change = safeJsonParse(changes[i]);
    const url = change && change.url ? change.url as string : undefined;
    if (url) return url;
  }
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
      return fetch(img.imageData);
    })
    .then(response => response.blob())
    .then(blob => {
      img.imageData = URL.createObjectURL(blob);
      resolve(img);
    })
    .catch(() => {
      reject();
    })
  );
}

export function getCCImagePath(imageKey: string) {
  return ccImageId + imageKey;
}

export function storeImage(db: DB, userId: string, file?: File, imagePath?: string): Promise<ISimpleImage> {
  const img: ISimpleImage = {
    imageUrl: placeholderImage,
    imageData: placeholderImage
  };

  return new Promise((resolve, reject) => {
    const imageUrl = file ? URL.createObjectURL(file) : imagePath ? imagePath : undefined;
    const imageName = file ? file.name : imagePath;
    if (!imageUrl) reject(img);

    resizeImage(imageUrl!, ImageConstants.maxWidth, ImageConstants.maxHeight)
      .then(imageData => {
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
      })
      .catch((e: any) => {
        if ((e instanceof Error) && (e.message.indexOf("converting") >= 0)) {
          resolve(img);
        }
        else {
          reject(e);
        }
      });
  });
}

// Image size functions
function resizeImage(imageUrl: string, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // this should really be done after onload/onerror have been set,
    // but for some reason that doesn't seem to work in Chrome Canary (72)
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

      const context = canvas.getContext("2d");

      context!.drawImage(image, 0, 0, newWidth, newHeight);
      // Return Base64 string of image
      try {
        const dataUrl = canvas.toDataURL();
        resolve(dataUrl);
      }
      catch (e) {
        reject(new Error(`Error converting image: ${imageUrl}`));
      }
    };
    image.onerror = (e: ErrorEvent) => {
      reject(new Error(`Error loading image: ${imageUrl}`));
    };
  });
}

export function getImageDimensions(url: string): Promise<IImageDimensions> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const dimensions = { src: image.src, width: image.width, height: image.height };
      resolve(dimensions);
    };
    image.src = url;
  });
}

export function getFileImageDimensions(file: File): Promise<IImageDimensions> {
  return getImageDimensions(URL.createObjectURL(file));
}
