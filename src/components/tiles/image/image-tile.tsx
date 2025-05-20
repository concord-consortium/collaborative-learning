import classNames from "classnames";
import React from "react";
import ResizeObserver from "resize-observer-polyfill";
import { observer, inject } from "mobx-react";
import { debounce } from "lodash";
import { BaseComponent } from "../../base";
import { EmptyImagePrompt } from "./empty-image-prompt";
import { ImageToolbar } from "./image-toolbar";
import { ImageComponent } from "./image-component";
import { ITileApi, TileResizeEntry } from "../tile-api";
import { ITileProps } from "../tile-component";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { debouncedSelectTile } from "../../../models/stores/ui";
import { EntryStatus, gImageMap, ImageMapEntry } from "../../../models/image-map";
import { ImageContentModelType } from "../../../models/tiles/image/image-content";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { ImageDragDrop } from "../../utilities/image-drag-drop";
import { isPlaceholderImage } from "../../../utilities/image-utils";
import placeholderImage from "../../../assets/image_placeholder.png";
import { HotKeys } from "../../../utilities/hot-keys";
import { getClipboardContent, pasteClipboardImage2 } from "../../../utilities/clipboard-utils";

import "./image-tile.sass";
import { autorun, IReactionDisposer } from "mobx";

type IProps = ITileProps;

interface IState {
  imageEntry?: ImageMapEntry;
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
  public state: IState = {
                           isEditingTitle: false
                         };
  // give each component instance a unique id
  private imageToolId = ++nextImageToolId;
  private toolbarToolApi: ITileApi | undefined;
  private resizeObserver: ResizeObserver;
  private imageElt: HTMLDivElement | null;
  private contentObserverDisposer: IReactionDisposer | null;

  private updateImage = (url: string, filename?: string) => {
    const promise = gImageMap.getImage(url, { filename });
    const entry = gImageMap.getCachedImage(url);
    this.setState({ imageEntry: entry });
    promise.then(image => {
      // update mst content if conversion occurred
      // FIXME: this might result in an extra action in the undo history.
      // This would be handled better by moving this updateImage into the model
      // as a flow action. This way the final URL change should be grouped in
      // the history event of which ever action caused the url to change in the
      // first place. The trick with that approach is how to handle the state
      // update. If the imageEntry was put in the model's volatile then the code
      // here could use that property instead of state.
      // Perhaps the imageEntry could be a view on the model. This way it would
      // only be loaded when the render requests it.
      // The trick with that is how to handle the upload file code path.
      // In that case we probably need to move the addFile action into the
      // image model. That way it could update an entry stored in volatile or
      // could store the temporary url which is then used by the view to get the
      // the current entry.
      if (image.contentUrl && (url !== image.contentUrl)) {
        this.getContent().updateImageUrl(url, image.contentUrl);
      }
    });
  };

  private imageDragDrop: ImageDragDrop;
  private hotKeys = new HotKeys();

  constructor(props: IProps) {
    super(props);

    this.imageDragDrop = new ImageDragDrop({
      isAcceptableImageDrag: this.isAcceptableImageDrag
    });
  }

  public componentDidMount() {
    // We do this as an autorun here instead of relying on render observation
    // This is because we don't want trigger a new image request on each render
    // If the image request was moved into the model, then this would be simplified
    this.contentObserverDisposer = autorun(() => {
      const { url, filename } = this.getContent();
      if (url) {
        this.updateImage(url, filename);
      }
    });

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this.imageElt) {
          // debounce to prevent resize loops
          this.handleResizeDebounced(entry);
        }
      }
    });
    this.imageElt && this.resizeObserver.observe(this.imageElt);

    this.props.onRegisterTileApi({
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
    this.hotKeys.register({
      "cmd-v": this.handlePaste,
    });
  }
  public componentWillUnmount() {
    this.resizeObserver.disconnect();
    this.handleResizeDebounced.cancel();
    this.contentObserverDisposer?.();
  }

  public componentDidUpdate(prevProps: IProps, prevState: IState) {
    // If the url changes, the autorun registered in componentDidMount
    // will take care of fetching the new image and updating the imageEntry

    // if we have a new image, or the image height has changed, request an explicit height
    const desiredHeight = this.getDesiredHeight();
    if (desiredHeight && (desiredHeight !== this.state.requestedHeight)) {
      this.props.onRequestRowHeight(this.props.model.id, desiredHeight);
      this.setState({ requestedHeight: desiredHeight });
    }
  }

  public render() {
    const { documentContent, tileElt, readOnly, scale } = this.props;
    const { imageEntry } = this.state;
    const showEmptyImagePrompt = !this.getContent().hasValidImage;

    const isLoading =
      imageEntry?.status === EntryStatus.PendingStorage || imageEntry?.status === EntryStatus.PendingDimensions;

    // TODO: I don't know what this comment means:
    // Include states for selected and editing separately to clean up UI a little

    // TODO: check the change in behavior here. Previously if the imageEntry had a displayUrl
    // that would be shown. This would be the case even if the image was loading.
    // This might have had the effect that an old image would continue to be shown with a
    // a spinner on top, when the image was replaced. Now this isn't possible becasue the
    // imageEntry is updated immediately when the image is replaced.
    const imageToUseForDisplay = isLoading ? "" : imageEntry?.displayUrl || placeholderImage as string;
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
          data-testid="image-tile"
          data-image-tool-id={this.imageToolId}
          onMouseDown={this.handleMouseDown}
          onDragOver={this.handleDragOver}
          onDrop={this.handleDrop}
          tabIndex={0}
          onKeyDown={(e) => this.hotKeys.dispatch(e)}
        >
          {isLoading && <div className="loading-spinner" />}
          <ImageToolbar
            onRegisterTileApi={(tileApi: ITileApi) => this.toolbarToolApi = tileApi}
            onUnregisterTileApi={() => this.toolbarToolApi = undefined}
            documentContent={documentContent}
            tileElt={tileElt}
            scale={scale}
            onIsEnabled={this.handleIsEnabled}
            onUploadImageFile={this.handleUploadImageFile}
          />
          <BasicEditableTileTitle />
          <ImageComponent
            ref={elt => this.imageElt = elt}
            style={imageDisplayStyle}
            onMouseDown={this.handleMouseDown}
          />
        </div>
        <EmptyImagePrompt show={showEmptyImagePrompt} />
      </>
    );
  }

  private handlePaste = async () => {
    // FIXME: With this new approach there will be a brief period of time when
    // displayed image is not updated. This will happen while waiting for the clipboard
    // content.
    const osClipboardContents = await getClipboardContent();
    if (osClipboardContents) {
      const result = pasteClipboardImage2(osClipboardContents);
      if (!result) return;
      result.promise.then(image => this.handleNewImage(image));
      this.setState({ imageEntry: result.entry });
    }
  };

  private handleUploadImageFile = (file: File) => {
    // This also returns the image map entry which should be put in the state instead
    // of isLoading
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { promise, entry } = gImageMap.addFileImage2(file);
    promise.then(image => this.handleNewImage(image));
    this.setState({ imageEntry: entry });
  };

  private handleNewImage = (image: ImageMapEntry) => {
    const content = this.getContent();
    if (image.contentUrl && (image.contentUrl !== content.url)) {
      content.setUrl(image.contentUrl, image.filename);
    }
  };

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

  // TODO: test that this is still working. It is called from componentDidUpdate
  // this should happen when the state, props, or the an observed property has changed
  // With the new approach we are observing the status of the imageEntry so that means
  // we should re-render when the dimensions change. And that should trigger
  // componentDidUpdate
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
