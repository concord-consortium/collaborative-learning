import { gImageMap, ImageMapEntryType} from "../models/image-map";

// interface IOnCompleteParams {
//   file?: File;
//   // imageMap: ImageMapEntryType;
//   imageUrl?: string;
// }

type OnComplete = (params: File | string) => void;

export const pasteClipboardImage = async (callback: OnComplete, mode: string) => { //mode either "file" or "url"
  console.log("clipboard-utils.ts\n invoke pasteClipboardImage() \n with callback \n", callback);
  // console.log("callback arguments are", callback.arguments[0]);
  // console.log(arguments);

  const clipboardContents = await navigator.clipboard.read();
  console.log("clipboard contents", clipboardContents);
  if (clipboardContents.length > 0) {
    if (clipboardContents[0].types.includes("image/png")) {
      clipboardContents[0].getType("image/png").then(blob => {
        const blobToFile = new File([blob], "clipboard-image");
        console.log("blob is\n", blob);
        console.log("blobToFile", blobToFile);


        gImageMap.addFileImage(blobToFile).then(image => {
          console.log("\n clipboard-util.ts \n image is :", image);
          console.log("\n clipboard-util.ts \n typeofImage :", typeof image);
            if (mode === "url"){
              callback(image.contentUrl || '');
            }
            if (mode === "file"){
              callback(blobToFile);
            }
            //with drawing tool we invoke call back with contentUrl (string ) (it is a setState)
            //with imageTool, we invoke this.handleUploadImagefile with a blobToFile (file)
        });

      });
    }
  }
};