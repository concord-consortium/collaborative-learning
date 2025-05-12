import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { observer, inject } from "mobx-react";

import { DataflowProgram } from "./dataflow-program";
import { BaseComponent } from "../../../components/base";
import { ITileModel } from "../../../models/tiles/tile-model";
import { ITileProps } from "../../../components/tiles/tile-component";
import { EditableTileTitle } from "../../../components/tiles/editable-tile-title";
import { DataflowContentModelType } from "../model/dataflow-content";
import { measureText } from "../../../components/tiles/hooks/use-measure-text";
import { defaultTileTitleFont } from "../../../components/constants";
import { TileTitleArea } from "../../../components/tiles/tile-title-area";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";

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
}

@inject("stores")
@observer
export default class DataflowToolComponent extends BaseComponent<IProps, IDataflowTileState> {
  public static tileHandlesSelection = true;

  constructor(props: IProps) {
    super(props);
    this.state = {
      isRecording: false,
      isPlaying: false,
      playBackIndex: 0,
      recordIndex: 0,
      isEditingTitle: false
    };
  }
  public render() {
    const { readOnly, height, model, onRegisterTileApi, tileElt } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `tile-content dataflow-tool ${editableClass}`;
    const { program, programDataRate } = this.getContent();
    const tileContent = this.getContent();

    return (
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
                />
              );
            }}
          </SizeMe>
          <TileToolbar tileType="dataflow" readOnly={!!readOnly} tileElement={this.props.tileElt} />
        </div>
      </>
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


