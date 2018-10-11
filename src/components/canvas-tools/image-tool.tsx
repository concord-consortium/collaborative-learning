import * as React from "react";
import firebase from "firebase";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { resizeImage } from "../../utilities/image-utils";
import "./image-tool.sass";

interface IProps {
  context: string;
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  imageUrl?: string;
  isEditing?: boolean;
  hasUpdatedUrl?: boolean;
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

  public render() {
    const { readOnly, model } = this.props;
    const { content } = model;
    const { isEditing, imageUrl } = this.state;
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
        <img className="image-tool-image" src={imageUrl} onError={this.handleImageUrlError} />
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

  private handleImageUrlError() {
    const { hasUpdatedUrl } = this.state;
    const { db } = this.stores;
    const { model } = this.props;
    const { content } = model;

    if (!hasUpdatedUrl) {
      const imageContent = content as ImageContentModelType;
      if (imageContent.storePath) {
        // fetch current live url from firebase
        db.firebase.getPublicUrlFromStore(imageContent.storePath).then((url) => {
          if (url) {
            this.updateURL(url, imageContent.storePath);
          } else {
            this.updateURL(imageContent.placeholder());
          }
        }).catch(() => {
          this.updateURL(imageContent.placeholder());
        });
      } else {
        // No firebase storage path
        this.updateURL(imageContent.placeholder());
      }
      this.setState({ hasUpdatedUrl: true });
    }
  }

  private handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { db } = this.stores;
    const files = e.currentTarget.files as FileList;
    const currentFile = files[0];

    resizeImage(currentFile, ImageConstants.maxWidth, ImageConstants.maxHeight).then((resizedImage: Blob) => {
      db.firebase.uploadImage(currentFile.name, currentFile, resizedImage).then((uploadRef) => {
        db.firebase.getPublicUrlFromStore(uploadRef).then((url) => {
          this.updateURL(url, uploadRef);
        });
      });
    });
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.setSelectedTile(this.props.model);
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
    this.setState({ isEditing: false });
  }
}
