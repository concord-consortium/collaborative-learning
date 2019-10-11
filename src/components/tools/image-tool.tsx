import * as React from "react";
import { observer, inject } from "mobx-react";
import CSS from "csstype";
import { BaseComponent, IBaseProps } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { gImageMap, ImageMapEntryType } from "../../models/image-map";
import { debounce } from "lodash";
const placeholderImage = require("../../public/images/image_placeholder.png");
import { autorun, IReactionDisposer } from "mobx";
import { ImageDragDrop } from "../utilities/image-drag-drop";

import "./image-tool.sass";

interface IProps extends IBaseProps {
  context: string;
  model: ToolTileModelType;
  readOnly?: boolean;
  onRequestRowHeight: (tileId: string, height: number) => void;
}

interface IState {
  isEditing?: boolean;
  isLoading?: boolean;
  imageContentUrl?: string;
  imageEntry?: ImageMapEntryType;
}

const defaultImagePlaceholderSize = { width: 128, height: 128 };

@inject("stores")
@observer
export default class ImageToolComponent extends BaseComponent<IProps, IState> {

  public state: IState = { isLoading: true };

  private syncedChanges: number;
  private _isMounted = false;
  private inputElt: HTMLInputElement | null;
  private disposers: IReactionDisposer[];
  private debouncedUpdateImage = debounce((url: string) => {
            gImageMap.getImage(url)
              .then(image => {
                if (!this._isMounted) return;
                // update react state
                this.setState({
                  isLoading: false,
                  imageContentUrl: undefined,
                  imageEntry: image
                });
                // update mst content if conversion occurred
                if (image.contentUrl && (url !== image.contentUrl)) {
                  this.getContent().updateImageUrl(url, image.contentUrl);
                }
              })
              .catch(() => {
                this.setState({
                  isLoading: false,
                  imageContentUrl: undefined,
                  imageEntry: undefined
                });
              });
          }, 100);
  private imageDragDrop: ImageDragDrop;

  public componentWillMount() {
    this.imageDragDrop = new ImageDragDrop({
      isAcceptableImageDrag: this.isAcceptableImageDrag
    });
  }

  public componentDidMount() {
    this._isMounted = true;
    this.syncedChanges = 0;
    this.disposers = [];
    if (this.state.imageContentUrl) {
      this.updateImageUrl(this.state.imageContentUrl);
    }

    this.disposers.push(autorun(() => {
      const content = this.getContent();
      if (content.changeCount > this.syncedChanges) {
        this.setState({
          isLoading: true,
          imageContentUrl: content.url
        });
        this.syncedChanges = content.changeCount;
      }
    }));
  }

  public componentWillUnmount() {
    this._isMounted = false;
    this.disposers.forEach(disposer => disposer());
  }

  public componentDidUpdate(prevProps: IProps, prevState: IState) {
    if (this.state.imageContentUrl) {
      this.updateImageUrl(this.state.imageContentUrl);
    }
    // if we have a new image, or the image height has changed, reqest an explicit height
    if (this.state.imageEntry && this.state.imageEntry.height
        && (!prevState.imageEntry || prevState.imageEntry.height !== this.state.imageEntry.height)) {
      this.props.onRequestRowHeight(this.props.model.id, this.state.imageEntry.height);
    }
  }

  public render() {
    const { readOnly, model } = this.props;
    const { isEditing, isLoading, imageEntry } = this.state;
    const { ui } = this.stores;

    const contentUrl = this.getContent().url;
    const isEditableUrl = gImageMap.isExternalUrl(contentUrl) && !gImageMap.isDataImageUrl(contentUrl);
    const editableUrl = isEditableUrl ? contentUrl : undefined;

    // Include states for selected and editing separately to clean up UI a little
    const editableClass = readOnly ? "read-only" : "editable";
    const selectedClass = ui.isSelectedTile(model) ? (isEditing && !readOnly ? "editing" : "selected") : "";
    const divClasses = `image-tool ${editableClass}`;
    const inputClasses = `image-url ${selectedClass}`;
    const fileInputClasses = `image-file ${selectedClass}`;
    const imageToolControlContainerClasses = `image-tool-controls ${readOnly ? "readonly" : selectedClass}`;
    const imageWidth = imageEntry && imageEntry.width || defaultImagePlaceholderSize.width;
    const imageHeight = imageEntry && imageEntry.height || defaultImagePlaceholderSize.height;
    const imageToUseForDisplay = imageEntry && imageEntry.displayUrl || (isLoading ? "" : placeholderImage);
    // Set image display properties for the div, since this won't resize automatically when the image changes
    const imageDisplayStyle: CSS.Properties = {
      backgroundImage: "url(" + imageToUseForDisplay + ")"
    };
    if (!imageEntry) {
      imageDisplayStyle.width = defaultImagePlaceholderSize.width + "px";
      imageDisplayStyle.height = defaultImagePlaceholderSize.height + "px";
    }
    return (
      <div className={divClasses}
        onMouseDown={this.handleMouseDown}
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop} >
        {isLoading && <div className="loading-spinner" />}
        <div className="image-tool-image" style={imageDisplayStyle} onMouseDown={this.handleMouseDown} />
        <div className={imageToolControlContainerClasses} onMouseDown={this.handleContainerMouseDown}>
          <input
            className={inputClasses}
            ref={elt => this.inputElt = elt}
            defaultValue={editableUrl}
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

  private getContent() {
    return this.props.model.content as ImageContentModelType;
  }

  private updateImageUrl(url: string) {
    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }
    this.debouncedUpdateImage(url);
  }

  private handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files as FileList;
    const currentFile = files[0];
    if (currentFile) {
      this.setState({ isLoading: true, isEditing: false }, () => {
        gImageMap.addFileImage(currentFile)
          .then(image => {
            if (this._isMounted) {
              const content = this.getContent();
              this.setState({ isLoading: false, imageEntry: image });
              if (image.contentUrl && (image.contentUrl !== content.url)) {
                content.setUrl(image.contentUrl);
              }
              if (this.inputElt) {
                this.inputElt.value = "";
              }
            }
          });
      });
    }
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.setSelectedTile(this.props.model);
    if (this.state.isEditing && (e.target === e.currentTarget)) {
      this.setState({ isEditing: false });
    }
}

  private handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!this.state.isEditing) {
      this.setState({ isEditing: true });
    }
    else if (e.target === e.currentTarget) {
      this.setState({ isEditing: false });
    }
  }

  private handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If we detect an enter key, treat the same way we handle losing focus,
    // i.e., attempt to change the URL for the image.
    if (e.keyCode === 13) {
      this.storeNewImageUrl(e.currentTarget.value);
    }
    else if (e.keyCode === 27) {
      this.setState({ isEditing: false });
    }
  }

  // User has input a new url into the input box, check the dimensions, upload to FB,
  // then update state and finally model
  private handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    this.setState({ isEditing: false });
    this.storeNewImageUrl(e.currentTarget.value);
  }

  private storeNewImageUrl(newUrl: string) {
    const { imageEntry } = this.state;
    const isExternalUrl = gImageMap.isExternalUrl(newUrl);
    const contentUrl = imageEntry && imageEntry.contentUrl;
    if (isExternalUrl && (newUrl !== contentUrl)) {
      gImageMap.getImage(newUrl)
        .then(image => {
          if (image.contentUrl && (image.displayUrl !== placeholderImage)) {
            this.getContent().setUrl(image.contentUrl);
            if (this.inputElt) {
              this.inputElt.value = image.contentUrl;
            }
          }
        });
    }
  }

  private isAcceptableImageDrag = (e: React.DragEvent<HTMLDivElement>) => {
    const { readOnly } = this.props;
    // image drop area is central 80% in each dimension
    if (!readOnly) {
      const kImgDropMarginPct = 0.1;
      const eltBounds = e.currentTarget.getBoundingClientRect();
      const kImgDropMarginX = eltBounds.width * kImgDropMarginPct;
      const kImgDropMarginY = eltBounds.height * kImgDropMarginPct;
      if ((e.clientX > eltBounds.left + kImgDropMarginX) &&
          (e.clientX < eltBounds.right - kImgDropMarginX) &&
          (e.clientY > eltBounds.top + kImgDropMarginY) &&
          (e.clientY < eltBounds.bottom - kImgDropMarginY)) {
        return true;
      }
    }
    return false;
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    this.imageDragDrop.dragOver(e);
  }

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    this.imageDragDrop.drop(e)
      .then((dropUrl) => {
        this.setState({ isEditing: false });
        this.storeNewImageUrl(dropUrl);
      })
      .catch((err) => {
        this.stores.ui.alert(err.toString());
      });
  }
}
