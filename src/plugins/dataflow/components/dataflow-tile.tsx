import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { observer, inject } from "mobx-react";

import { isCurriculumDocument } from "../../../models/document/document-types";
import { DataflowProgram } from "./dataflow-program";
import { BaseComponent } from "../../../components/base";
import { ITileModel } from "../../../models/tiles/tile-model";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ITileProps } from "../../../components/tiles/tile-component";
import { EditableTileTitle } from "../../../components/tiles/editable-tile-title";
import { DataflowContentModelType } from "../model/dataflow-content";
import { measureText } from "../../../components/tiles/hooks/use-measure-text";
import { defaultTileTitleFont } from "../../../components/constants";
import { TileTitleArea } from "../../../components/tiles/tile-title-area";
import { DataflowLinkTableButton } from "./ui/dataflow-program-link-table-button";
import { ITileLinkMetadata } from "../../../models/tiles/tile-link-types";
import { getDocumentContentFromNode } from "../../../utilities/mst-utils";

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
    const { readOnly, height, model } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `dataflow-tool disable-tile-content-drag ${editableClass}`;
    const { program, programDataRate, programZoom } = this.getContent();
    const tileContent = this.getContent();
    const runnable = this.getRunnable();

    return (
      <>
        <TileTitleArea>
          {this.renderTitle()}
          {this.renderTableLinkButton()}
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
                  runnable={runnable}
                  size={size}
                  tileHeight={height}
                  tileContent={tileContent}
                />
              );
            }}
          </SizeMe>
        </div>
      </>
    );
  }

  public componentDidMount() {
    this.props.onRegisterTileApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return this.getContent().exportJson(options);
      }
    });
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

  private renderTableLinkButton() {
    const { model, documentId } = this.props;
    const documentContent = getDocumentContentFromNode(model);
    const linkableTiles = documentContent?.getLinkableTiles();
    const isLinkButtonEnabled = linkableTiles && linkableTiles.consumers.length > 0;
    const actionHandlers = {
                             handleRequestTableLink: this.handleRequestTableLink,
                             handleRequestTableUnlink: this.handleRequestTableUnlink
                           };

    return (!this.state.isEditingTitle && !this.props.readOnly &&
      <DataflowLinkTableButton
        key="link-button"
        isLinkButtonEnabled={isLinkButtonEnabled}
        //use in useTableLinking
        documentId={documentId}
        model={model}
        actionHandlers={actionHandlers}
      />
    );
  }

  private handleRequestTableLink = (tileInfo: ITileLinkMetadata) => {
    this.getContent().addLinkedTile(tileInfo.id);
  };

  private handleRequestTableUnlink = (tileInfo: ITileLinkMetadata) => {
    this.getContent().removeLinkedTable(tileInfo.id);
  };

  private getRunnable = () => {
    const isCurriculum = isCurriculumDocument(this.props.documentId);
    return !this.props.readOnly || isCurriculum;
  };

  private getContent() {
    return this.props.model.content as DataflowContentModelType;
  }
}


