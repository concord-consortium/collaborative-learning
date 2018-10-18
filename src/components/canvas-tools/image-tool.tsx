import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { fetchImageUrl, uploadImage, getDimensions } from "../../utilities/image-utils";
import "./image-tool.sass";

interface IProps {
  context: string;
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  imageUrl?: string;
  isEditing?: boolean;
  isLoading?: boolean;
  imageDimensions?: any;
}

const defaultImagePlaceholderSize = { width: 200, height: 200 };

@inject("stores")
@observer
export default class ImageToolComponent extends BaseComponent<IProps, {}> {

  public state: IState = { isLoading: true, imageUrl: "assets/image_placeholder.png" };
  private _asyncRequest: any;

  public componentDidMount() {
    const { model: { content } } = this.props;
    const { db } = this.stores;
    const imageContent = content as ImageContentModelType;

    // Migrate Firebase storage relative URLs to full URLs
    fetchImageUrl(imageContent.url, db.firebase, ((url: string) => {
      this.handleUpdateImageDimensions(url);
      this.updateStoredURL(url);
    }));
  }

  public componentWillUnmount() {
    if (this._asyncRequest) {
      this._asyncRequest = null;
    }
  }

  public componentDidUpdate(nextProps: IProps) {
    const { model: { content } } = nextProps;
    const { imageUrl, isLoading } = this.state;

    const imageContent = content as ImageContentModelType;
    if (!isLoading && imageUrl && imageContent.url && imageContent.url !== imageUrl) {
      this.handleUpdateImageDimensions(imageContent.url);
    }
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
    const imageToUseForDisplay =
      imageContent.url && imageContent.url.length > 0 ? imageContent.url : imageUrl;

    // Set image display properties for the div, since this won't resize automatically when the image changes
    const imageDisplayStyle = {
      backgroundImage: "url(" + imageToUseForDisplay + ")",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
      width: dimensions.width + "px ",
      height: dimensions.height + "px"
    };
    return (
      <div className={divClasses} onMouseDown={this.handleMouseDown} onBlur={this.handleExitBlur}>
        {isLoading && <div className="loading-spinner" />}
        <div className="image-tool-image" style={imageDisplayStyle} />
        <div className={imageToolControlContainerClasses} onMouseDown={this.handleContainerMouseDown}>
          <input
            className={inputClasses}
            defaultValue={imageToUseForDisplay}
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

  private handleUpdateImageDimensions = (imageDisplayUrl: string) => {
    this._asyncRequest = getDimensions(undefined, imageDisplayUrl).then((dimensions: any) => {
      this._asyncRequest = null;
      this.setState({
        imageUrl: imageDisplayUrl,
        imageDimensions: dimensions,
        isLoading: false
      });
    });
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
      this.handleUpdateImageDimensions(imageUrl);
      this.updateStoredURL(imageUrl);
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
      const newUrl = e.currentTarget.value;
      if (newUrl !== this.state.imageUrl) {
        this.updateImageFromInput(newUrl);
      }
    }
  }

  private handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newUrl = e.currentTarget.value;
    if (newUrl !== this.state.imageUrl) {
      this.updateImageFromInput(newUrl);
    }
  }

  // User has input a new url into the input box, check the dimensions and update model and state
  private updateImageFromInput = (newUrl: string) => {
    this.handleUpdateImageDimensions(newUrl);
    this.updateStoredURL(newUrl);
  }

  private handleExitBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    this.setState({ isEditing: false });
  }

  private updateStoredURL = (newUrl: string) => {
    const imageContent = this.props.model.content as ImageContentModelType;
    if (newUrl !== imageContent.url) {
      imageContent.setUrl(newUrl);
    }
  }
}
