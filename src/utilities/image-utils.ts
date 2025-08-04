import { DB } from "../lib/db";
import { ImageModelType, ImageModel } from "../models/image";
import { PLACEHOLDER_IMAGE_PATH } from "./image-constants";

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
  imageData: string;
}

const ccImageId = "ccimg://";

// Due to Webpack's url-loader, historically the placeholder image has been
// converted to a data URI at bundle time. Therefore, the placeholder "url"
// was a data URI that contained the placeholder image data. When the
// placeholder image was changed, this was changed so that now the placeholder
// image is represented by a URL, but the original data URI placeholder image
// is still present in documents.
export function isPlaceholderImage(url?: string) {
  // Handle mocked test values
  if (url === 'test-file-stub') {
    return true;
  }
  // Handle actual file paths and URLs
  return !!(url && url.match(/image_placeholder(_org)?\.png$/));
}
// TODO:   return !!(url && (url.match(PLACEHOLDER_IMAGE_PATH) || (url.match(PLACEHOLDER_ORG_IMAGE_PATH))));

function kUploadImage(db: DB, image: ImageModelType): Promise<ISimpleImage> {
  const img: ISimpleImage = {
    imageUrl: PLACEHOLDER_IMAGE_PATH,
    imageData: PLACEHOLDER_IMAGE_PATH
  };

  return new Promise((resolve, reject) =>
    db.addImage(image).then(dbImage => {
      img.imageKey = dbImage.image.self.imageKey;
      img.imageData = dbImage.image.imageData;
      // starting with 2.1.3, image url includes class hash and image key
      img.imageUrl = getCCImagePath(`${db.stores.user.classHash}/${dbImage.image.self.imageKey}`);
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

export function storeCorsImage(db: DB, imagePath: string): Promise<ISimpleImage> {
  return storeImage(db, imagePath, imagePath, true);
}

export function storeFileImage(db: DB, file: File): Promise<ISimpleImage> {
  const url = URL.createObjectURL(file);
  return storeImage(db, url, file.name);
}

export function storeImage(db: DB, url: string, name?: string, cors?: boolean): Promise<ISimpleImage> {
  const img: ISimpleImage = {
    imageUrl: PLACEHOLDER_IMAGE_PATH,
    imageData: PLACEHOLDER_IMAGE_PATH
  };

  return new Promise((resolve, reject) => {
    if (!url) reject(img);

    // This downloads the url onto a canvas and returns a data url for the canvas.
    resizeImage(url, ImageConstants.maxWidth, ImageConstants.maxHeight, cors)
      .then(imageData => {
        const _name = name || url;
        const image: ImageModelType = ImageModel.create({
          key: "",
          imageData,
          title: _name,
          originalSource: _name,
          createdAt: 0,
          createdBy: db.stores.user.id
        });
        // This does not download the imageData again, but it does use
        // fetch to turn it into a blob object.
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
function resizeImage(imageUrl: string, maxWidth: number, maxHeight: number, cors?: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (cors) {
      // This is necessary for access to firebase storage urls, (and presumably other
      // cors-aware resources), but prevents generic urls from loading successfully.
      image.crossOrigin = "anonymous";
    }
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
    image.onerror = (e) => {
      reject(new Error(`Error loading image: ${imageUrl}`));
    };
    image.src = imageUrl;
  });
}

export function getImageDimensions(url: string): Promise<IImageDimensions> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const dimensions = { src: image.src, width: image.width, height: image.height };
      resolve(dimensions);
    };
    image.onerror = (e) => {
      reject(new Error(`Error getting dimensions of image: ${url}`));
    };
    image.src = url;
  });
}

export function getFileImageDimensions(file: File): Promise<IImageDimensions> {
  return getImageDimensions(URL.createObjectURL(file));
}
