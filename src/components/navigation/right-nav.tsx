import { inject, observer } from "mobx-react";
import * as React from "react";

import "./right-nav.sass";
import { TabComponent } from "../tab";
import { TabSetComponent } from "../tab-set";
import { BaseComponent, IBaseProps } from "../base";
import { MyWorkComponent } from "../thumbnail/my-work";
import { ClassWorkComponent } from "../thumbnail/class-work";
import { ClassLogsComponent } from "../thumbnail/class-logs";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
}

interface IState {
  myWorkLoadAllowed: boolean;
  classWorkLoadAllowed: boolean;
  classLogsLoadAllowed: boolean;
  navExpanding: boolean;
}

// cf. right-nav.sass: $list-item-scale
const kRightNavItemScale = 0.11;

@inject("stores")
@observer
export class RightNavComponent extends BaseComponent<IProps, IState> {

  private expandedAreaRef = React.createRef<HTMLDivElement>();

  constructor(props: IProps) {
    super(props);
    this.state = {
      myWorkLoadAllowed: false,
      classWorkLoadAllowed: false,
      classLogsLoadAllowed: false,
      navExpanding: false
    };
  }

  public componentDidMount() {
    const node = this.expandedAreaRef.current;
    if (node) {
      node.addEventListener("transitionend", this.transitionEnd);
    }
  }

  public componentWillUnmount() {
    const node = this.expandedAreaRef.current;
    if (node) {
      node.removeEventListener("transitionend", this.transitionEnd);
    }
  }

  public transitionEnd = () => {
    this.setState({
      navExpanding: false,
    });
    this.updateComponentLoadAllowedState();
  }

  public render() {
    const {activeRightNavTab, rightNavExpanded} = this.stores.ui;
    const teacherTabs = ["Class Work", "Class Logs"];
    const studentTabs = ["My Work"].concat(teacherTabs);
    const tabs = this.props.isGhostUser ? teacherTabs : studentTabs;
    return (
      <div className="right-nav">
        <TabSetComponent className={rightNavExpanded ? "expanded" : undefined}>
          {tabs.map((tab) => {
            return (
              <TabComponent
                id={this.getTabId(tab)}
                key={tab}
                active={rightNavExpanded && (activeRightNavTab === tab)}
                onClick={this.handleTabClick(tab)}
              >
                {tab}
              </TabComponent>
            );
          })}
        </TabSetComponent>
        <div
          className={`expanded-area${rightNavExpanded ? " expanded" : ""}`}
          aria-labelledby={this.getTabId(activeRightNavTab)}
          aria-hidden={!rightNavExpanded}
          ref={this.expandedAreaRef}
        >
          {this.renderTabContents()}
        </div>
      </div>
    );
  }

  private renderTabContents() {
    const {activeRightNavTab} = this.stores.ui;
    return (
      <div className="contents">
        { this.state.myWorkLoadAllowed
          ? <div className={"container " + (activeRightNavTab === "My Work" ? "enabled" : "disabled")}>
              <MyWorkComponent scale={kRightNavItemScale}/>
            </div>
          : this.renderLoadingText("My Work")
        }
        { this.state.classWorkLoadAllowed
          ? <div className={"container " + (activeRightNavTab === "Class Work" ? "enabled" : "disabled")}>
              <ClassWorkComponent scale={kRightNavItemScale}/>
          </div>
          : this.renderLoadingText("Class Work")
        }
        { this.state.classLogsLoadAllowed
          ? <div className={"container " + (activeRightNavTab === "Class Logs" ? "enabled" : "disabled")}>
              <ClassLogsComponent scale={kRightNavItemScale}/>
            </div>
          : this.renderLoadingText("Class Logs")
        }
      </div>
    );
  }

  private renderLoadingText(tab: string) {
    const {activeRightNavTab} = this.stores.ui;
    return (
      <div>
        { tab === activeRightNavTab
          ? <div className="loading">loading...</div>
          : null
        }
      </div>
    );
  }

  private handleTabClick = (tab: string) => {
    const { ui } = this.stores;
    const navDoneExpanding = ui.rightNavExpanded;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (!navDoneExpanding) {
        this.setState({navExpanding: true});
      }
      if (ui.activeRightNavTab !== tab) {
        ui.setActiveRightNavTab(tab);
        this.stores.ui.toggleRightNav(true);
      } else {
        this.stores.ui.toggleRightNav();
      }
      if (navDoneExpanding) {
        this.updateComponentLoadAllowedState();
      }
    };
  }

  private getTabId(tab: string) {
    return `rightNavTab${tab}`;
  }

  private updateComponentLoadAllowedState = () => {
    const { ui } = this.stores;
    if (ui.activeRightNavTab === "My Work") {
      this.setState({myWorkLoadAllowed: true});
    } else if (ui.activeRightNavTab === "Class Work") {
      this.setState({classWorkLoadAllowed: true});
    } else if (ui.activeRightNavTab === "Class Logs") {
      this.setState({classLogsLoadAllowed: true});
    }
  }

}
