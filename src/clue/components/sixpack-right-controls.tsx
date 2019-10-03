import { inject } from "mobx-react";
import * as React from "react";
import { ToggleGroup } from "../../components/toggle-group";

import "./sixpack-right-controls.sass";
import { ProgressWidget, IProgressItem } from "./progress-widget";
import { BaseComponent } from "../../components/base";

type LiveOrPub = "live" | "pub";
interface IProps {}
interface IState {
  mode: LiveOrPub;
}

@inject("stores")
export class SixPackRightControls extends BaseComponent<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      mode: "live"
    };
  }

  public render() {
    const { mode } = this.state;
    const live = mode === "live";
    const pub  = mode === "pub";
    const modeOptions = [{
        label: "Current Work",
        selected: live,
        onClick: () => this.setState({mode: "live"})
      },
      {
        label: "Published Work",
        selected: pub,
        onClick: () => this.setState({mode: "pub"})
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
  private setLive = () => this.setState({mode: "live"});
  private setPub = () => this.setState({mode: "pub"});
}
