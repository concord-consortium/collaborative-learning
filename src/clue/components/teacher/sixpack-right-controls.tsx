import { inject } from "mobx-react";
import React from "react";
import { BaseComponent } from "../../../components/base";
import { DocumentViewMode } from "../../../components/document/document";
import { ToggleGroup, IToggleChoice, Themes } from "@concord-consortium/react-components";
import { ProgressWidget } from "../progress-widget";
import "./sixpack-right-controls.scss";

const Colors = Themes.Default;

interface IProps {
  documentViewMode: DocumentViewMode;
  selectedSectionId: string | null;
  setDocumentViewMode: (documentViewMode: DocumentViewMode) => void;
  setSelectedSectionId: (sectionId: string) => void;
}

@inject("stores")
export class SixPackRightControls extends BaseComponent<IProps> {
  constructor(props: IProps) {
    super(props);
  }

  public render() {
    const {
      documentViewMode,
      setDocumentViewMode,
      selectedSectionId,
      setSelectedSectionId
    } = this.props;

    const modeOptions: IToggleChoice[] = [{
        label: "Current Work",
        selected: documentViewMode === DocumentViewMode.Live,
        onClick: () => setDocumentViewMode(DocumentViewMode.Live),
      },
      {
        label: "Published Work",
        selected: documentViewMode === DocumentViewMode.Published,
        onClick: () => setDocumentViewMode(DocumentViewMode.Published),
        colors: {
          selectedColor:  {
            color: "white",
            background: Colors.Cloud["cloud-dark-5"]
          },
          hoverColor: {
            color: Colors.Cloud["cloud-dark-5"],
            background: Colors.Cloud["cloud-dark-2"]
          },
          unselectedColor:  {
            color: Colors.Cloud["cloud-dark-5"],
            background: Colors.Cloud["cloud-light-2"]
          }
        },
      }
    ];

    return(
      <div className="sixpack-right-controls">
        <div className="top-controls">
          <ToggleGroup options={modeOptions} orientation="vertical"/>
        </div>
        <div className="bottom-controls">
          <ProgressWidget
            selectedSectionId={selectedSectionId}
            setSelectedSectionId={setSelectedSectionId}
          />
        </div>
        <div className="pager-controls">
          {this.props.children}
        </div>
      </div>
    );
  }
}
