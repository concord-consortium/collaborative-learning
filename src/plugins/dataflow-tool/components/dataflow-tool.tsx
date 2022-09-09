import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { observer, inject } from "mobx-react";
import { DataflowProgram } from "./dataflow-program";
import { BaseComponent } from "../../../components/base";
import { DocumentModelType } from "../../../models/document/document";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { ITileExportOptions } from "../../../models/tools/tool-content-info";
import { IToolTileProps } from "../../../components/tools/tool-tile";
import { EditableTileTitle } from "../../../components/tools/editable-tile-title";
import { DataflowContentModelType } from "../model/dataflow-content";
import { measureText } from "../../../components/tools/hooks/use-measure-text";
import { defaultTileTitleFont } from "../../../components/constants";
import { ToolTitleArea } from "../../../components/tools/tool-title-area";

import "./dataflow-tool.scss";

interface IProps extends IToolTileProps{
  model: ToolTileModelType;
  readOnly?: boolean;
  height?: number;
}

@inject("stores")
@observer
export default class DataflowToolComponent extends BaseComponent<IProps> {

  public static tileHandlesSelection = true;

  public render() {
    const { model, readOnly, height } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `dataflow-tool disable-tile-content-drag ${editableClass}`;
    const { program, programDataRate, programZoom } = this.getContent();
    const showOriginalProgramButton = !!this.getOriginalProgramDocument();
    return (
      <>
        <ToolTitleArea>{this.renderTitle()}</ToolTitleArea>
        <div className={classes}>
          <SizeMe monitorHeight={true}>
            {({ size }: SizeMeProps) => {
              return (
                <DataflowProgram
                  modelId={model.id}
                  readOnly={readOnly}
                  documentProperties={this.getDocumentProperties()}
                  program={program}
                  onProgramChange={this.handleProgramChange}
                  onShowOriginalProgram={showOriginalProgramButton ? this.handleShowOriginalProgram : undefined}
                  programDataRate={programDataRate}
                  onProgramDataRateChange={this.handleProgramDataRateChange}
                  programZoom={programZoom}
                  onZoomChange={this.handleProgramZoomChange}
                  size={size}
                  tileHeight={height}
                />
              );
            }}
          </SizeMe>
        </div>
      </>
    );
  }

  public componentDidMount() {
    this.props.onRegisterToolApi({
      getTitle: () => {
        return this.getTitle();
      },
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return this.getContent().exportJson(options);
      }
    });

    if (this.getTitle() === '') {
      const { model: { id }, onRequestUniqueTitle } = this.props;
      const title = onRequestUniqueTitle(id);
      title && this.getContent().setTitle(title);
    }
  }

  private getDocument() {
    const { documents, ui: { problemWorkspace: { primaryDocumentKey } } } = this.stores;
    return primaryDocumentKey ? documents.getDocument(primaryDocumentKey) : undefined;
  }

  private getDocumentProperties() {
    const document = this.getDocument();
    return document && document.properties.toJSON();
  }

  private handleTitleChange = (title?: string) => {
    title && this.getContent().setTitle(title);
  };

  private renderTitle() {
    const size = {width: null, height: null};
    const { readOnly, scale } = this.props;
    return (
      <EditableTileTitle
        key="dataflow-title"
        size={size}
        scale={scale}
        getTitle={this.getTitle.bind(this)}
        readOnly={readOnly}
        measureText={(text) => measureText(text, defaultTileTitleFont)}
        onEndEdit={this.handleTitleChange}
      />
    );
  }

  private getTitle() {
    return this.getContent().title || "";
  }

  private switchToDocument(document: DocumentModelType) {   // FIXME: This will be different in tile format
    // if (document) {
    //   const { ui } = this.stores;
    //   ui.problemWorkspace.toggleComparisonVisible({ override: false });
    //   ui.problemWorkspace.setPrimaryDocument(document);
    //   ui.setActiveRightNavTab(ERightNavTab.kMyWork);
    // }
  }

  private handleProgramChange = (program: any) => {
    this.getContent().setProgram(program);
  };

  private getOriginalProgramDocument = () => {
    const { documents } = this.stores;
    const document = this.getDocument();
    const originDocumentId = document && document.properties.get("dfProgramId");
    const originDocument = originDocumentId ? documents.getDocument(originDocumentId) : undefined;
    return originDocument?.getProperty("isDeleted") ? undefined : originDocument;
  };

  private handleShowOriginalProgram = () => {
    const originDocument = this.getOriginalProgramDocument();
    originDocument && this.switchToDocument(originDocument);
  };

  private handleProgramDataRateChange = (program: any) => {
    this.getContent().setProgramDataRate(program);
  };

  private handleProgramZoomChange = (dx: number, dy: number, scale: number) => {
    this.getContent().setProgramZoom(dx, dy, scale);
  };

  private getContent() {
    return this.props.model.content as DataflowContentModelType;
  }
}
