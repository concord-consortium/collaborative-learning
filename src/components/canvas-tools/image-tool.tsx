import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { DB } from "../../lib/db";

import "./image-tool.sass";

interface IProps {
  context: string;
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  currentFile?: File;
}

@inject("stores")
@observer
export default class ImageToolComponent extends BaseComponent<IProps, {}> {

  public state: IState = {};

  public render() {
    const { readOnly, model } = this.props;
    const { content } = model;
    const { ui } = this.stores;
    const imageContent = content as ImageContentModelType;
    const editableClass = readOnly ? "read-only" : "editable";
    const selectedClass = ui.isSelectedTile(model) ? "selected" : "";
    const divClasses = `image-tool ${editableClass}`;
    const inputClasses = `image-url ${selectedClass}`;
    const fileInputClasses = `image-file ${selectedClass}`;
    const fileUploadClasses = `image-file-upload ${selectedClass}`;
    return (
      <div className={divClasses} onMouseDown={this.handleMouseDown} >
        <img src={imageContent.url} />
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
        <button
          className={fileUploadClasses}
          onClick={this.handleUploadButton}>Upload</button>
      </div>
    );
  }

  private handleUploadButton = (e: React.MouseEvent<HTMLButtonElement>) => {
    const { db } = this.stores;
    const { currentFile } = this.state;

    if (currentFile) {
      const fileReader = new FileReader();
      const fileString = fileReader.readAsBinaryString(currentFile);
      const ref = db.firebase.storeRef("/" + currentFile.name);
      ref.put(currentFile).then((snapshot) => {
        // console.log(`"${currentFile.name}" (${currentFile.size} bytes): ${snapshot.bytesTransferred} transferred`);
        // this.updateURL(db.firebase.getRootFolder()
        this.getUrlFromFirestore();
      });
    }
  }
  private getUrlFromFirestore() {
    const { db } = this.stores;
    const { currentFile } = this.state;
    if (currentFile) {
      const imageRef = db.firebase.storeRef().child(currentFile.name);
      // Get the download URL - returns a url with an authentication token for the current session
      imageRef.getDownloadURL().then((url) => {
        this.updateURL(url);
      }).catch((error) => {
          switch (error.code) {
          case "storage/object-not-found":
            // File doesn't exist
            break;

          case "storage/unauthorized":
            // User doesn't have permission to access the object
            break;

          case "storage/canceled":
            // User canceled the upload
            break;

          case "storage/unknown":
            // Unknown error occurred, inspect the server response
            break;
        }
      });
    }
  }
  private handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files as FileList;
    const fileReader = new FileReader();
    fileReader.onloadend = () => {
      this.setState({ currentFile: files[0] });
      // const fileContent = fileReader.result;
      // console.log(`File Content of "${files[0].name}" (${files[0].size} bytes): ` + fileContent);
    };
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.setSelectedTile(this.props.model);
  }

  private handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If we detect an enter key, treat the same way we handle losing focus,
    // i.e., attempt to change the URL for the image.
    if (e.keyCode === 13) {
      this.updateURL(e.currentTarget.value);
    }
  }

  private handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    this.updateURL(e.currentTarget.value);
  }

  private updateURL = (newUrl: string) => {
    const imageContent = this.props.model.content as ImageContentModelType;
    imageContent.setUrl(newUrl);
  }
}
