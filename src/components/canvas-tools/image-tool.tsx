import * as React from "react";
import firebase from "firebase";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { resizeImage } from "../../utilities/image-resize";
import "./image-tool.sass";

interface IProps {
  context: string;
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  imageUrl?: string;
  logOutput?: string;
  isEditing?: boolean;
}

const ImageConstants = {
  maxWidth: 512,
  maxHeight: 512
};

@inject("stores")
@observer
export default class ImageToolComponent extends BaseComponent<IProps, {}> {

  public static getDerivedStateFromProps = (props: IProps, state: IState) => {
    const { model: { content } } = props;
    const imageContent = content as ImageContentModelType;
    const newState: IState = { imageUrl: imageContent.url };
    return newState;
  }
  public state: IState = {};

  // public componentDidMount() {
  //   const { model: { content } } = this.props;
  //   const imageContent = content as ImageContentModelType;
  //   if (imageContent.storePath) {
  //     // may call a state update when it completes
  //     this.getUrlFromStore(imageContent.storePath);
  //   }
  // }

  public render() {
    const { readOnly, model } = this.props;
    const { content } = model;
    const { isEditing } = this.state;
    const { ui } = this.stores;
    const imageContent = content as ImageContentModelType;
    const editableClass = readOnly ? "read-only" : "editable";
    // Include states for selected and editing separately to clean up UI a little
    const selectedClass = ui.isSelectedTile(model) ? (isEditing ? "editing" : "selected") : "";
    const divClasses = `image-tool ${editableClass}`;
    const inputClasses = `image-url ${selectedClass}`;
    const fileInputClasses = `image-file ${selectedClass}`;
    const imageToolControlContainerClasses = `image-tool-controls ${selectedClass}`;

    return (
      <div className={divClasses} onMouseDown={this.handleMouseDown} onBlur={this.handleExitBlur}>
        <img className="image-tool-image" src={imageContent.url} />
        <div className={imageToolControlContainerClasses} onMouseDown={this.handleContainerMouseDown}>
          <input
            className={inputClasses}
            defaultValue={imageContent.url}
            onBlur={this.handleBlur}
            onKeyUp={this.handleKeyUp}
          />
          <input
            className={fileInputClasses}
            type="file"
            accept="image/png, image/jpeg"
            onChange={this.handleOnChange}
          />
        </div>
      </div>
    );
  }
  // If we need to refresh the url + token then use the stored Firebase storage path
  private getUrlFromStore(storePath: string) {
    const { db } = this.stores;
    const storage = db.firebase.firestore();
    const ref = storage.ref(storePath);
    return this.getUrlFromFirestore(ref);
  }

  private getUrlFromFirestore(imageRef: firebase.storage.Reference) {
    // Get the download URL - returns a url with an authentication token for the current session
    imageRef.getDownloadURL().then((url) => {
      this.updateURL(url, imageRef.fullPath);
    }).catch((error) => {
      switch (error.code) {
        case "storage/object-not-found":
          // File doesn't exist
          this.showMessage("file does not exist!");
          break;

        case "storage/unauthorized":
          // User doesn't have permission to access the object
          this.showMessage("You do not have permission");
          break;

        case "storage/canceled":
          // User canceled the upload
          this.showMessage("Upload cancelled");
          break;

        case "storage/unknown":
          // Unknown error occurred, inspect the server response
          this.showMessage("Unknown error uploading image");
          break;
      }
      this.updateURL("assets/image_placeholder.png");
    });
  }

  // TODO: This will not exist once this branch work has been completed - leaving in for now for WIP development
  private showMessage(message: string, append: boolean = false) {
    const { logOutput } = this.state;
    // TODO: Figure out user-friendly way to show information
    // console.log(message);
    let newOutput = message;
    if (logOutput && append) {
      newOutput = logOutput + "\n " + message;
    }
    this.setState({ logOutput: newOutput });
  }

  private handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files as FileList;
    const currentFile = files[0];

    this.showMessage(`File selected "${currentFile.name}" (${currentFile.size} bytes)`);

    resizeImage(currentFile, ImageConstants.maxWidth, ImageConstants.maxHeight).then((resizedImage: Blob) => {
      this.uploadImage(currentFile.name, currentFile, resizedImage);
    });
  }

  private uploadImage(fileName: string, file: File, imageData?: Blob) {
    const { db } = this.stores;
    const ref = db.firebase.storeRef("/" + fileName);
    const fileData = imageData ? imageData : file;
    ref.put(fileData).then((snapshot) => {
      // Confirm upload and get fs path to store
      this.showMessage(`"${fileName}": ${snapshot.bytesTransferred} transferred`);
      const imageRef = db.firebase.storeRef().child(fileName);
      this.getUrlFromFirestore(imageRef);
    });
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.setSelectedTile(this.props.model);
    const imageContent = this.props.model.content as ImageContentModelType;
    this.showMessage(imageContent.storePath + " " + imageContent.url);
  }

  private handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const { isEditing } = this.state;
    if (!isEditing) {
      this.setState({ isEditing: true });
    }
  }

  private handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If we detect an enter key, treat the same way we handle losing focus,
    // i.e., attempt to change the URL for the image.
    if (e.keyCode === 13) {
      this.updateURL(e.currentTarget.value);
    }
  }

  private handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.currentTarget.value !== this.state.imageUrl) {
      this.updateURL(e.currentTarget.value);
    }
  }

  private handleExitBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    this.setState({ isEditing: false });
  }

  private updateURL = (newUrl: string, storePath?: string) => {
    const imageContent = this.props.model.content as ImageContentModelType;
    imageContent.setUrl(newUrl, storePath);
    this.showMessage("---path set!--- " + storePath, true);
    this.setState({ isEditing: false });
  }
}
