import { inject, observer } from "mobx-react";
import * as React from "react";

import "./bottom-nav.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";
import { LearningLogComponent } from "./learning-log";

interface IProps extends IBaseProps {}

interface IState {
  componentHeight: number;
  expandedHeight: number;
}

const HEADER_HEIGHT = 55;
const TAB_HEIGHT = 35;

@inject("stores")
@observer
export class BottomNavComponent extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      componentHeight: 0,
      expandedHeight: 0
    };
  }

  public componentDidMount() {
    this.handleSetHeight();
    window.addEventListener("resize", this.handleSetHeight);
  }

  public componentWillUnmount() {
    window.removeEventListener("resize", this.handleSetHeight);
  }

  public render() {
    const { bottomNavExpanded } = this.stores.ui;
    const className = `bottom-nav${bottomNavExpanded ? " expanded" : ""}`;
    const componentStyle = bottomNavExpanded ? {height: this.state.componentHeight} : {};
    const expandedStyle = {height: this.state.expandedHeight};
    return (
      <div className={className} style={componentStyle}>
        <TabSetComponent>
          <TabComponent id="learningLogTab" active={bottomNavExpanded} onClick={this.handleClick}>
            Learning Log
          </TabComponent>
        </TabSetComponent>
        <div
          className="expanded-area"
          aria-labelledby="learningLogTab"
          aria-hidden={!bottomNavExpanded}
          style={expandedStyle}
        >
          <div className="contents">
            <LearningLogComponent />
          </div>
        </div>
      </div>
    );
  }

  private handleClick = () => {
    this.stores.ui.toggleBottomNav();
  }

  private handleSetHeight = () => {
    const app = document.getElementById("app");
    if (app) {
      const appHeight = app.getBoundingClientRect().height;
      this.setState({
        componentHeight: appHeight - HEADER_HEIGHT,
        expandedHeight: appHeight - HEADER_HEIGHT - (TAB_HEIGHT / 2)
      });
    }
  }
}
