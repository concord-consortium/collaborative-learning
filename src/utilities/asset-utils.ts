declare const __webpack_public_path__: string;

export function getAssetUrl(url: string) {
  if (typeof __webpack_public_path__ === "undefined") {
    return url;
  }
  const urlObj = new URL(url, __webpack_public_path__);
  return urlObj.href;  
}
