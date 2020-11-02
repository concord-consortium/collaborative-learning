import classNames from "classnames";
import React from "react";
import ResizeObserver from "resize-observer-polyfill";
import { IReactionDisposer } from "mobx";
import { observer, inject } from "mobx-react";
import { debounce } from "lodash";
import { BaseComponent } from "../base";
import { EmptyImagePrompt } from "./image/empty-image-prompt";
import { ImageToolbar } from "./image/image-toolbar";
import { ImageComponent } from "./image-component";
import { IToolApi, IToolTileProps } from "./tool-tile";
import { IDocumentContext } from "../../models/document/document-types";
import { debouncedSelectTile } from "../../models/stores/ui";
import { gImageMap, IImageContext, ImageMapEntryType } from "../../models/image-map";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { hasSelectionModifier } from "../../utilities/event-utils";
import { ImageDragDrop } from "../utilities/image-drag-drop";
import { isPlaceholderImage } from "../../utilities/image-utils";
import placeholderImage from "../../assets/image_placeholder.png";

import "./image-tool.sass";

type IProps = IToolTileProps;

interface IState {
  isLoading?: boolean;
  imageContentUrl?: string;
  documentContext?: IDocumentContext;
  imageEntry?: ImageMapEntryType;
  imageEltWidth?: number;
  imageEltHeight?: number;
  requestedHeight?: number;
}

const defaultImagePlaceholderSize = { width: 100, height: 100 };

@inject("stores")
@observer
export default class ImageToolComponent extends BaseComponent<IProps, IState> {

  public state: IState = { isLoading: true };

  private _isMounted = false;
  private toolbarToolApi: IToolApi | undefined;
  private resizeObserver: ResizeObserver;
  private imageElt: HTMLDivElement | null;
  private disposers: IReactionDisposer[];
  private debouncedUpdateImage = debounce(async (url: string) => {
    const { documentContext } = this.state;
    const imageContext: IImageContext | undefined = documentContext
                                                      ? { type: documentContext?.type, key: documentContext?.key }
                                                      : undefined;
    gImageMap.getImage(url, imageContext)
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

  constructor(props: IProps) {
    super(props);

    this.imageDragDrop = new ImageDragDrop({
      isAcceptableImageDrag: this.isAcceptableImageDrag
    });
  }

  public componentDidMount() {
    this._isMounted = true;
    this.disposers = [];
    if (this.state.imageContentUrl) {
      this.updateImageUrl(this.state.imageContentUrl);
    }

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this.imageElt) {
          // debounce to prevent resize loops
          debounce(() => {
            const {width, height} = entry.contentRect;
            this.setState({ imageEltWidth: Math.ceil(width), imageEltHeight: Math.ceil(height) });
          }, 100);
        }
      }
    });
    this.imageElt && this.resizeObserver.observe(this.imageElt);

    this.props.onRegisterToolApi({
      handleDocumentScroll: (x: number, y: number) => {
        this.toolbarToolApi?.handleDocumentScroll?.(x, y);
      },
      handleTileResize: (entry: ResizeObserverEntry) => {
        this.toolbarToolApi?.handleTileResize?.(entry);
      }
    });
  }

  public componentWillUnmount() {
    this._isMounted = false;
    this.disposers.forEach(disposer => disposer());
    this.resizeObserver.disconnect();
  }

  public componentDidUpdate(prevProps: IProps, prevState: IState) {
    if (this.state.imageContentUrl) {
      this.updateImageUrl(this.state.imageContentUrl);
    }
    // if we have a new image, or the image height has changed, reqest an explicit height
    const desiredHeight = this.getDesiredHeight();
    if (desiredHeight && (desiredHeight !== this.state.requestedHeight)) {
      this.props.onRequestRowHeight(this.props.model.id, desiredHeight);
      this.setState({ requestedHeight: desiredHeight });
    }
  }

  public render() {
    const { documentContent, toolTile, readOnly } = this.props;
    const { isLoading, imageEntry } = this.state;
    const showEmptyImagePrompt = !this.getContent().hasValidImage;

    // Include states for selected and editing separately to clean up UI a little
    const imageToUseForDisplay = imageEntry?.displayUrl || (isLoading ? "" : placeholderImage);
    // Set image display properties for the div, since this won't resize automatically when the image changes
    const imageDisplayStyle: React.CSSProperties = {
      backgroundImage: "url(" + imageToUseForDisplay + ")"
    };
    if (!imageEntry) {
      imageDisplayStyle.width = defaultImagePlaceholderSize.width + "px";
      imageDisplayStyle.height = defaultImagePlaceholderSize.height + "px";
    }
    return (
      <>
        <div className={classNames("image-tool", readOnly ? "read-only" : "editable")}
          onMouseDown={this.handleMouseDown}
          onDragOver={this.handleDragOver}
          onDrop={this.handleDrop} >
          {isLoading && <div className="loading-spinner" />}
          <ImageToolbar
            onRegisterToolApi={(toolApi: IToolApi) => this.toolbarToolApi = toolApi}
            onUnregisterToolApi={() => this.toolbarToolApi = undefined}
            documentContent={documentContent}
            toolTile={toolTile}
            onIsEnabled={this.handleIsEnabled}
            onUploadImageFile={this.handleUploadImageFile}
          />
          <ImageComponent
            ref={elt => this.imageElt = elt}
            content={this.getContent()}
            style={imageDisplayStyle}
            onMouseDown={this.handleMouseDown}
            onUrlChange={this.handleUrlChange}
          />
        </div>
        <EmptyImagePrompt show={showEmptyImagePrompt} />
      </>
    );
  }

  private handleIsEnabled = () => {
    const { model: { id }, readOnly } = this.props;
    const { ui } = this.stores;
    return !readOnly &&
            (ui?.selectedTileIds.length === 1) &&
            (ui?.selectedTileIds.includes(id));
  }

  private getDesiredHeight() {
    const kMarginsAndBorders = 26;
    const { imageEntry, imageEltWidth } = this.state;
    if (!imageEntry?.width || !imageEntry?.height) return;
    const naturalHeight = Math.ceil(imageEntry.height);
    const aspectRatio = imageEntry.width / imageEntry.height;
    return aspectRatio && imageEltWidth
            ? Math.min(Math.ceil(imageEltWidth / aspectRatio), naturalHeight) + kMarginsAndBorders
            : naturalHeight + kMarginsAndBorders;
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

  private handleUploadImageFile = (file: File) => {
    this.setState({ isLoading: true }, () => {
      gImageMap.addFileImage(file)
        .then(image => {
          if (this._isMounted) {
            const content = this.getContent();
            this.setState({ isLoading: false, imageEntry: image });
            if (image.contentUrl && (image.contentUrl !== content.url)) {
              content.setUrl(image.contentUrl);
            }
          }
        });
    });
  }

  private handleUrlChange = (url: string, context?: IDocumentContext) => {
    this.setState({
      isLoading: true,
      imageContentUrl: url,
      documentContext: context
    });
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    debouncedSelectTile(this.stores.ui, this.props.model, hasSelectionModifier(e));
  }

  private storeNewImageUrl(newUrl: string) {
    const { imageEntry } = this.state;
    const isExternalUrl = gImageMap.isExternalUrl(newUrl);
    const contentUrl = imageEntry && imageEntry.contentUrl;
    if (isExternalUrl && (newUrl !== contentUrl)) {
      gImageMap.getImage(newUrl)
        .then(image => {
          if (image.contentUrl && !isPlaceholderImage(image.displayUrl)) {
            this.getContent().setUrl(image.contentUrl);
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
        this.storeNewImageUrl(dropUrl);
      })
      .catch((err) => {
        this.stores.ui.alert(err.toString());
      });
  }
}
