import * as React from "react";
import { ToggleGroup } from "../../components/toggle-group";

import "./sixpack-right-controls.sass";
import { ProgressWidget, IProgressItem } from "./progress-widget";

type LiveOrPub = "live" | "pub";
interface IProps {}
interface IState {
  mode: LiveOrPub;
}

export class SixPackRightControls extends React.Component<IProps, IState> {
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
    const progressItems: IProgressItem[] = [
      {
        label: "IN",
        completed: 12,
        total: 24,
        selected: false
      },
      {
        label: "MA",
        completed: 12,
        total: 20,
        selected: true
      },
      {
        label: "HI",
        completed: 2,
        total: 14,
        selected: false
      }

    ];
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
