import { inject, observer } from "mobx-react";
import * as React from "react";

import "./bottom-nav.sass";
import { TabComponent } from "../tab";
import { TabSetComponent } from "../tab-set";
import { BaseComponent, IBaseProps } from "../base";
import { LearningLogComponent } from "../thumbnail/learning-log";

interface IProps extends IBaseProps {}

interface IState {
  componentHeight: number;
  expandedHeight: number;
  contentLoadAllowed: boolean;
  navExpanding: boolean;
}

const HEADER_HEIGHT = 55;
const TAB_HEIGHT = 35;

@inject("stores")
@observer
export class BottomNavComponent extends BaseComponent<IProps, IState> {

  private expandedAreaRef = React.createRef<HTMLDivElement>();

  constructor(props: IProps) {
    super(props);

    this.state = {
      componentHeight: 0,
      expandedHeight: 0,
      contentLoadAllowed: false,
      navExpanding: false
    };
  }

  public componentDidMount() {
    const node = this.expandedAreaRef.current;
    if (node) {
      node.addEventListener("transitionend", this.transitionEnd);
    }

    this.handleSetHeight();
    window.addEventListener("resize", this.handleSetHeight);
  }

  public componentWillUnmount() {
    const node = this.expandedAreaRef.current;
    if (node) {
      node.removeEventListener("transitionend", this.transitionEnd);
    }
    window.removeEventListener("resize", this.handleSetHeight);
  }

  public transitionEnd = () => {
    this.setState({
      navExpanding: false,
    });
    this.setState({contentLoadAllowed: true});
  }

  public render() {
    const { bottomNavExpanded } = this.stores.ui;
    const className = `bottom-nav${bottomNavExpanded ? " expanded" : ""}`;
    const componentStyle = bottomNavExpanded ? {height: this.state.componentHeight} : {};
    const expandedStyle = {height: this.state.expandedHeight};
    return (
      <div className={className} style={componentStyle} ref={this.expandedAreaRef}>
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
          { this.state.contentLoadAllowed
            ? <div className="contents">
                <LearningLogComponent />
              </div>
            : <div className="loading">loading...</div>
          }
        </div>
      </div>
    );
  }

  private handleClick = () => {
    const { bottomNavExpanded } = this.stores.ui;
    const navDoneExpanding = bottomNavExpanded;
    if (!navDoneExpanding) {
      this.setState({navExpanding: true});
    }
    this.stores.ui.toggleBottomNav();
    if (navDoneExpanding) {
      this.setState({contentLoadAllowed: true});
    }
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
