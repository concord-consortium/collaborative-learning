import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { observer, inject } from "mobx-react";
import classNames from "classnames";

import { DataflowProgram, IDataflowProgramApi } from "./dataflow-program";
import { BaseComponent } from "../../../components/base";
import { ITileModel } from "../../../models/tiles/tile-model";
import { ITileProps } from "../../../components/tiles/tile-component";
import { EditableTileTitle } from "../../../components/tiles/editable-tile-title";
import { DataflowContentModelType } from "../model/dataflow-content";
import { measureText } from "../../../components/tiles/hooks/use-measure-text";
import { defaultTileTitleFont } from "../../../components/constants";
import { TileTitleArea } from "../../../components/tiles/tile-title-area";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { ReteManager } from "../nodes/rete-manager";
import { DataflowReteManagerContext } from "./dataflow-rete-manager-context";
import { ClueTileAccessibilityBridge } from "../../../hooks/use-clue-accessibility";
import { getEditableTitleElement } from "../../../utilities/dom-utils";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ITileApi } from "../../../components/tiles/tile-api";

import "../dataflow-toolbar-registration";
import "./dataflow-tile.scss";

interface IProps extends ITileProps{
  model: ITileModel;
  readOnly?: boolean;
  height?: number;
}

interface IDataflowTileState {
  isRecording: boolean;
  isPlaying: boolean;
  playBackIndex: number;
  recordIndex: number; //# of ticks for record
  isEditingTitle: boolean;
  reteManager: ReteManager | undefined;
}

@inject("stores")
@observer
export default class DataflowToolComponent extends BaseComponent<IProps, IDataflowTileState> {
  public static tileHandlesSelection = true;

  private programContainerEl: HTMLElement | null = null;
  private programApi: IDataflowProgramApi | null = null;

  constructor(props: IProps) {
    super(props);
    this.state = {
      isRecording: false,
      isPlaying: false,
      playBackIndex: 0,
      recordIndex: 0,
      isEditingTitle: false,
      reteManager: undefined
    };
  }

  // Read-only tiles don't render <ClueTileAccessibilityBridge> (which only sets
  // up the editable focus trap), so they need to register the additional tile
  // API (exportContentAsTileJson, getObjectBoundingBox) directly. componentDidMount
  // runs after children's componentDidMount, so the program API ref is already set.
  public componentDidMount() {
    if (this.props.readOnly) {
      this.props.onRegisterTileApi(this.getAdditionalApi());
    }
  }

  public componentWillUnmount() {
    if (this.props.readOnly) {
      this.props.onUnregisterTileApi();
    }
  }

  private handleReteManagerCreated = (reteManager: ReteManager | undefined) => {
    this.setState({ reteManager });
  };

  private getAdditionalApi = (): ITileApi => ({
    exportContentAsTileJson: (options?: ITileExportOptions) => {
      return this.getContent().exportJson(options);
    },
    getObjectBoundingBox: (objectId, objectType) => {
      return this.programApi?.getObjectBoundingBox(objectId, objectType);
    },
  });

  public render() {
    const { readOnly, height, model, onRegisterTileApi, tileElt } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = classNames("tile-content", "dataflow-tool", editableClass, {
      hovered: this.props.hovered,
      selected: this.stores.ui.isSelectedTile(model)
    });
    const { program, programDataRate } = this.getContent();
    const tileContent = this.getContent();

    return (
      <DataflowReteManagerContext.Provider value={this.state.reteManager ?? null}>
        <>
        <TileTitleArea>
          {this.renderTitle()}
        </TileTitleArea>
        <div className={classes}>
          <SizeMe monitorHeight={true}>
            {({ size }: SizeMeProps) => {
              return (
                <DataflowProgram
                  documentProperties={this.getDocumentProperties()}
                  tileId={model.id}
                  program={program}
                  programDataRate={programDataRate}
                  readOnly={readOnly}
                  size={size}
                  tileHeight={height}
                  tileContent={tileContent}
                  tileElt={tileElt}
                  onRegisterTileApi={onRegisterTileApi}
                  onReteManagerCreated={this.handleReteManagerCreated}
                  onProgramContainerRef={el => this.programContainerEl = el}
                  onProgramApiRef={api => this.programApi = api}
                />
              );
            }}
          </SizeMe>
          <TileToolbar tileType="dataflow" readOnly={!!readOnly} tileElement={this.props.tileElt} />
        </div>
        {!readOnly && (
          <ClueTileAccessibilityBridge
            tileType="dataflow"
            onRegisterTileApi={this.props.onRegisterTileApi}
            onUnregisterTileApi={this.props.onUnregisterTileApi}
            getTitleElement={() => getEditableTitleElement(this.props.tileElt ?? undefined)}
            getContentElement={() =>
              this.programContainerEl?.querySelector<HTMLElement>(".dataflow-program-content")
              ?? undefined}
            getTopbarElement={() =>
              this.programContainerEl?.querySelector<HTMLElement>(".program-editor-topbar")
              ?? undefined}
            getPaletteElement={() =>
              this.programContainerEl?.querySelector<HTMLElement>(".program-toolbar") ?? undefined}
            additionalApi={this.getAdditionalApi()}
          />
        )}
        </>
      </DataflowReteManagerContext.Provider>
    );
  }

  private getDocument() {
    const { documents, persistentUI: { problemWorkspace: { primaryDocumentKey } } } = this.stores;
    return primaryDocumentKey ? documents.getDocument(primaryDocumentKey) : undefined;
  }

  private getDocumentProperties() {
    const document = this.getDocument();
    return document && document.properties.toJSON();
  }

  private handleBeginEditTitle = () => {
    this.setState({isEditingTitle: true});
  };

  private handleTitleChange = (title?: string) => {
    this.setState({isEditingTitle: false});
  };

  private renderTitle() {
    return (
      <EditableTileTitle
        key="dataflow-title"
        measureText={(text) => measureText(text, defaultTileTitleFont)}
        onBeginEdit={this.handleBeginEditTitle}
        onEndEdit={this.handleTitleChange}
      />
    );
  }

  private getContent() {
    return this.props.model.content as DataflowContentModelType;
  }
}
