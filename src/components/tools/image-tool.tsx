import classNames from "classnames";
import React from "react";
import ResizeObserver from "resize-observer-polyfill";
import { observer, inject } from "mobx-react";
import { debounce } from "lodash";
import { BaseComponent } from "../base";
import { EmptyImagePrompt } from "./image/empty-image-prompt";
import { ImageToolbar } from "./image/image-toolbar";
import { ImageComponent } from "./image-component";
import { IToolApi, TileResizeEntry } from "./tool-api";
import { IToolTileProps } from "./tool-tile";
import { measureText } from "./hooks/use-measure-text";
import { IDocumentContext } from "../../models/document/document-types";
import { debouncedSelectTile } from "../../models/stores/ui";
import { gImageMap, ImageMapEntryType } from "../../models/image-map";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { ITileExportOptions } from "../../models/tools/tool-content-info";
import { EditableTileTitle } from "./editable-tile-title";
import { defaultTileTitleFont } from "../constants";
import { hasSelectionModifier } from "../../utilities/event-utils";
import { ImageDragDrop } from "../utilities/image-drag-drop";
import { isPlaceholderImage } from "../../utilities/image-utils";
import placeholderImage from "../../assets/image_placeholder.png";

import "./image-tool.sass";

type IProps = IToolTileProps;

interface IState {
  isLoading?: boolean;
  imageContentUrl?: string;
  imageFilename?: string;
  documentContext?: IDocumentContext;
  imageEntry?: ImageMapEntryType;
  imageEltWidth?: number;
  imageEltHeight?: number;
  requestedHeight?: number;
  isEditingTitle?: boolean;
}

const defaultImagePlaceholderSize = { width: 100, height: 100 };

let nextImageToolId = 0;

@inject("stores")
@observer
export default class ImageToolComponent extends BaseComponent<IProps, IState> {
  public state: IState = { isLoading: true,
                           imageContentUrl: this.getContent().url,
                           isEditingTitle: false
                         };
  // give each component instance a unique id
  private imageToolId = ++nextImageToolId;
  private _isMounted = false;
  private toolbarToolApi: IToolApi | undefined;
  private resizeObserver: ResizeObserver;
  private imageElt: HTMLDivElement | null;
  private updateImage = (url: string, filename?: string) => {

    gImageMap.getImage(url, { filename })
      .then(image => {
        if (!this._isMounted) return;
        // update react state
        this.setState({
          isLoading: false,
          imageContentUrl: undefined,
          imageFilename: undefined,
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
          imageFilename: undefined,
          imageEntry: undefined
        });
      });
  };
  private imageDragDrop: ImageDragDrop;

  constructor(props: IProps) {
    super(props);

    this.imageDragDrop = new ImageDragDrop({
      isAcceptableImageDrag: this.isAcceptableImageDrag
    });
  }

  public componentDidMount() {
    this._isMounted = true;
    if (this.state.imageContentUrl) {
      this.updateImageUrl(this.state.imageContentUrl, this.state.imageFilename);
    }

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this.imageElt) {
          // debounce to prevent resize loops
          this.handleResizeDebounced(entry);
        }
      }
    });
    this.imageElt && this.resizeObserver.observe(this.imageElt);

    this.props.onRegisterToolApi({
      getTitle: () => {
        return this.getTitle();
      },
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return this.getContent().exportJson(options);
      },
      handleDocumentScroll: (x: number, y: number) => {
        this.toolbarToolApi?.handleDocumentScroll?.(x, y);
      },
      handleTileResize: (entry: TileResizeEntry) => {
        this.toolbarToolApi?.handleTileResize?.(entry);
      }
    });
    
    // Taken and modified from geometry-content.tsx.
    // TODO: This should be abstracted for all tiles.
    // if we haven't been assigned a title already, request one now
    if (this.getTitle() === '') {
      const { model: { id }, onRequestUniqueTitle } = this.props;
      const title = onRequestUniqueTitle(id);
      title && this.getContent().setTitle(title);
    }
  }

  public componentWillUnmount() {
    this.resizeObserver.disconnect();
    this._isMounted = false;
  }

  public componentDidUpdate(prevProps: IProps, prevState: IState) {
    if (this.state.imageContentUrl) {
      this.updateImageUrl(this.state.imageContentUrl, this.state.imageFilename);
    }
    // if we have a new image, or the image height has changed, request an explicit height
    const desiredHeight = this.getDesiredHeight();
    if (desiredHeight && (desiredHeight !== this.state.requestedHeight)) {
      this.props.onRequestRowHeight(this.props.model.id, desiredHeight);
      this.setState({ requestedHeight: desiredHeight });
    }
  }

  public render() {
    const { documentContent, toolTile, readOnly, scale } = this.props;
    const { isLoading, imageEntry } = this.state;
    const showEmptyImagePrompt = !this.getContent().hasValidImage;

    // Include states for selected and editing separately to clean up UI a little
    const imageToUseForDisplay = imageEntry?.displayUrl || (isLoading ? "" : placeholderImage as string);
    // Set image display properties for the div, since this won't resize automatically when the image changes
    const imageDisplayStyle: React.CSSProperties = {
      backgroundImage: "url(" + imageToUseForDisplay + ")"
    };
    if (!imageEntry) {
      imageDisplayStyle.width = `${defaultImagePlaceholderSize.width}px`;
      imageDisplayStyle.height = `${defaultImagePlaceholderSize.height}px`;
    }
    return (
      <>
        <div className={classNames("image-tool", readOnly ? "read-only" : "editable")}
          data-image-tool-id={this.imageToolId}
          onMouseDown={this.handleMouseDown}
          onDragOver={this.handleDragOver}
          onDrop={this.handleDrop} >
          {isLoading && <div className="loading-spinner" />}
          <ImageToolbar
            onRegisterToolApi={(toolApi: IToolApi) => this.toolbarToolApi = toolApi}
            onUnregisterToolApi={() => this.toolbarToolApi = undefined}
            documentContent={documentContent}
            toolTile={toolTile}
            scale={scale}
            onIsEnabled={this.handleIsEnabled}
            onUploadImageFile={this.handleUploadImageFile}
          />
          {this.renderTitleArea()}
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
  };

  private handleResizeDebounced = debounce((entry: ResizeObserverEntry) => {
    const {width, height} = entry.contentRect;
    this.setState({ imageEltWidth: Math.ceil(width), imageEltHeight: Math.ceil(height) });
  }, 100);

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

  private handleBeginEditTitle = () => {
    this.setState({ isEditingTitle: true });
  };

  private handleTitleChange = (title?: string) => {
    title && this.getContent().setTitle(title);
    this.setState({ isEditingTitle: false });
  };

  private renderTitleArea() {
    return (
      <div className="title-area-wrapper" key="title-area">
        <div className="title-area">
          {this.renderTitle()}
        </div>
      </div>
    );
  }

  private getTitle() {
    return this.getContent().title || "";
  }

  private renderTitle() {
    const { readOnly, scale } = this.props;
    const size = {width: this.state.imageEltWidth || null , height: this.state.imageEltHeight || null};
    return (
      <EditableTileTitle key="geometry-title" size={size} scale={scale} getTitle={this.getTitle.bind(this)}
                              readOnly={readOnly} measureText={(text) => measureText(text, defaultTileTitleFont)}
                              onBeginEdit={this.handleBeginEditTitle} onEndEdit={this.handleTitleChange} />
    );
  }

  private getContent() {
    return this.props.model.content as ImageContentModelType;
  }

  private updateImageUrl(url: string, filename?: string) {
    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }
    this.updateImage(url, filename);
  }

  private handleUploadImageFile = (file: File) => {
    this.setState({ isLoading: true }, () => {
      gImageMap.addFileImage(file)
        .then(image => {
          if (this._isMounted) {
            const content = this.getContent();
            this.setState({ isLoading: false, imageEntry: image });
            if (image.contentUrl && (image.contentUrl !== content.url)) {
              content.setUrl(image.contentUrl, file.name);
            }
          }
        });
    });
  };

  private handleUrlChange = (url: string, filename?: string, context?: IDocumentContext) => {
    this.setState({
      isLoading: true,
      imageContentUrl: url,
      imageFilename: filename,
      documentContext: context
    });
  };

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    debouncedSelectTile(this.stores.ui, this.props.model, hasSelectionModifier(e));
  };

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
  };

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    this.imageDragDrop.dragOver(e);
  };

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    this.imageDragDrop.drop(e)
      .then((dropUrl) => {
        this.storeNewImageUrl(dropUrl);
      })
      .catch((err) => {
        this.stores.ui.alert(err.toString());
      });
  };
}
