import { inject } from "mobx-react";
import * as React from "react";
import { ToggleGroup } from "../../components/toggle-group";

import "./sixpack-right-controls.sass";
import { ProgressWidget, IProgressItem } from "./progress-widget";
import { BaseComponent } from "../../components/base";
import { DocumentViewMode } from "../../components/teacher/teacher-group-tab";

interface IProps {
  documentViewMode: DocumentViewMode;
  setDocumentViewMode: (documentViewMode: DocumentViewMode) => void;
}

@inject("stores")
export class SixPackRightControls extends BaseComponent<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render() {
    const { documentViewMode, setDocumentViewMode } = this.props;
    const modeOptions = [{
        label: "Current Work",
        selected: documentViewMode === DocumentViewMode.Live,
        onClick: () => setDocumentViewMode(DocumentViewMode.Live)
      },
      {
        label: "Published Work",
        selected: documentViewMode === DocumentViewMode.Published,
        onClick: () => setDocumentViewMode(DocumentViewMode.Published)
      }
    ];
    const { problem } = this.stores;
    const { sections } = problem;
    const makeProgressItem = (s: string) => {
      return {
        label: s,
        completed: Math.floor(Math.random() * 12) + 1,
        total: 12,
        selected: false
      };
    };

    const progressItems = sections.map(s => makeProgressItem(s.abbrev));
    return(
      <div className="sixpack-right-controls">
        <div className="top-controls">
          <ToggleGroup options={modeOptions} orientation="vertical"/>
        </div>
        <div className="bottom-controls">
          <ProgressWidget items={progressItems} />
        </div>
        <div className="pager-controls">
          {this.props.children}
        </div>
      </div>
    );
  }
}
