import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { fetchImageUrl, uploadImage, getImageDimensions } from "../../utilities/image-utils";
import "./image-tool.sass";
import { url } from "inspector";

interface IProps {
  context: string;
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  imageUrl?: string;
  isEditing?: boolean;
  isLoading?: boolean;
  hasUpdatedUrl?: boolean;
  imageDimensions?: any;
}

const defaultImagePlaceholderSize = { width: 200, height: 200 };

@inject("stores")
@observer
export default class ImageToolComponent extends BaseComponent<IProps, {}> {

  public static getDerivedStateFromProps = (props: IProps, state: IState) => {
    const { model: { content } } = props;
    const imageContent = content as ImageContentModelType;
    const newState: IState = { imageUrl: imageContent.url };
    return newState;
  }

  public state: IState = { isLoading: true };

  public componentDidMount() {
    const { model: { content } } = this.props;
    const { db } = this.stores;
    const imageContent = content as ImageContentModelType;
    fetchImageUrl(imageContent.url, db.firebase, (fullUrl: string) => {
      getImageDimensions((dimensions: any) => {
        this.setState({ imageUrl: fullUrl, imageDimensions: dimensions, isLoading: false });
      }, undefined, fullUrl);
    });
  }

  public render() {
    const { readOnly, model } = this.props;
    const { content } = model;
    const { isEditing, isLoading, imageUrl, imageDimensions } = this.state;
    const { ui } = this.stores;
    const imageContent = content as ImageContentModelType;
    const editableClass = readOnly ? "read-only" : "editable";

    // Include states for selected and editing separately to clean up UI a little
    const selectedClass = ui.isSelectedTile(model) ? (isEditing && !readOnly ? "editing" : "selected") : "";
    const divClasses = `image-tool ${editableClass}`;
    const inputClasses = `image-url ${selectedClass}`;
    const fileInputClasses = `image-file ${selectedClass}`;
    const imageToolControlContainerClasses = !readOnly ? `image-tool-controls ${selectedClass}`
      : `image-tool-controls readonly`;

    const dimensions = imageDimensions ? imageDimensions : defaultImagePlaceholderSize;
    // Set image display properties for the div, since this won't resize automatically when the image changes
    const imageDisplayStyle = {
      background: "url(" + imageUrl + ")",
      backgroundRepeat: "no-repeat",
      width: dimensions.width + "px ",
      height: dimensions.height + "px"
    };

    return (
      <div className={divClasses} onMouseDown={this.handleMouseDown} onBlur={this.handleExitBlur}>
        {isLoading && <div className="loading-spinner" />}
        <div className="image-tool-image" style={imageDisplayStyle} onError={this.handleImageUrlError} />
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

  private handleImageUrlError = () => {
    const { hasUpdatedUrl } = this.state;
    const { db } = this.stores;
    const { model } = this.props;
    const { content } = model;

    if (!hasUpdatedUrl) {
      const imageContent = content as ImageContentModelType;
      let updatedUrl = imageContent.url;
      fetchImageUrl(imageContent.url, db.firebase, (fullUrl: string) => {
        updatedUrl = fullUrl;
      });
      this.setState({ hasUpdatedUrl: true, imageUrl: updatedUrl });
    }
  }

  private handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { db } = this.stores;
    const files = e.currentTarget.files as FileList;
    const currentFile = files[0];
    // Getting the path at this level gives the correct path to the user's current storage location
    const storePath = db.firebase.getFullPath(currentFile.name);

    // Set loading state for showing spinner
    this.setState({ isLoading: true });

    uploadImage(db.firebase, storePath, currentFile, (imageUrl: string) => {
      getImageDimensions((dimensions: any) => {
        this.setState({ imageDimensions: dimensions, isLoading: false, isEditing: false});
        this.updateURL(imageUrl);
      }, undefined, imageUrl);
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

  private updateURL = (newUrl: string) => {
    const imageContent = this.props.model.content as ImageContentModelType;
    imageContent.setUrl(newUrl);
  }
}
