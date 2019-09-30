import * as React from "react";
import { Button, ButtonGroup } from "@blueprintjs/core";
import "./sixpack-right-controls.sass";

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
    const liveClasses = mode === "live" ? "live selected" : "live";
    const pubClasses = mode === "pub" ? "pub selected" : "pub";
    return(
      <div className="sixpack-right-controls">
        <div className="top-controls">
          <ButtonGroup vertical={true} className="smaller">
            <Button className={liveClasses} onClick={this.setLive}>Live</Button>
            <Button className={pubClasses} onClick={this.setPub}>Pub</Button>
          </ButtonGroup>
        </div>
        <div className="bottom-controls">
          <div className="section-progress"> Progress </div>
          <div> {this.props.children} </div>
        </div>
      </div>
    );
  }
  private setLive = () => this.setState({mode: "live"});
  private setPub = () => this.setState({mode: "pub"});
}
