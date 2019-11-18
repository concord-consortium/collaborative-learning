import { inject, observer } from "mobx-react";
import * as React from "react";

import { TabComponent } from "../tab";
import { TabSetComponent } from "../tab-set";
import { BaseComponent, IBaseProps } from "../base";
import { RightNavTabContents } from "../thumbnail/right-nav-tab-contents";
import { ERightNavTab, NavTabSectionModelType, RightNavTabMap, RightNavTabSpec } from "../../models/view/right-nav";
import { map } from "lodash";
import "./right-nav.sass";

// cf. right-nav.sass: $list-item-scale
const kRightNavItemScale = 0.11;

export const StudentWorkComponent = () => {
  return <RightNavTabContents tabId={ERightNavTab.kStudentWork} className="student-work" scale={kRightNavItemScale} />;
};

export const MyWorkComponent = () => {
  return <RightNavTabContents tabId={ERightNavTab.kMyWork} className="my-work" scale={kRightNavItemScale} />;
};

export const ClassWorkComponent = () => {
  return <RightNavTabContents tabId={ERightNavTab.kClassWork} className="class-work" scale={kRightNavItemScale} />;
};

export const LearningLogsComponent = () => {
  return <RightNavTabContents tabId={ERightNavTab.kLearningLog} className="learning-log" scale={kRightNavItemScale} />;
};

interface ISupportsComponentProps {
  onToggleExpansion: (section: NavTabSectionModelType) => void;
}
export const SupportsComponent = ({ onToggleExpansion }: ISupportsComponentProps) => {
  return <RightNavTabContents tabId={ERightNavTab.kSupports} className="supports" scale={kRightNavItemScale}
                              onToggleExpansion={onToggleExpansion} />;
};

interface IProps extends IBaseProps {
  tabs?: RightNavTabSpec[];
  isGhostUser: boolean;
  isTeacher: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

interface IState {
  tabLoadAllowed: Partial< RightNavTabMap<boolean> >;
  navExpanding: boolean;
}

@inject("stores")
@observer
export class RightNavComponent extends BaseComponent<IProps, IState> {

  private expandedAreaRef = React.createRef<HTMLDivElement>();

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabLoadAllowed: {},
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
    const {onDragOver, onDrop} = this.props;
    const {activeRightNavTab, rightNavExpanded} = this.stores.ui;
    const tabSpecs = this.props.tabs && this.props.tabs
                      .filter(tabSpec => !(this.props.isGhostUser && tabSpec.hideGhostUser))
                      .filter(tabSpec => tabSpec.teacherOnly ? this.props.isTeacher : true);
    if (!tabSpecs || !tabSpecs.length) return null;
    return (
      <div className="right-nav" onDragOver={onDragOver} onDrop={onDrop}>
        <TabSetComponent className={rightNavExpanded ? "expanded" : undefined}>
          {tabSpecs.map(spec => {
            return (
              <TabComponent
                id={this.getTabId(spec.tab)}
                key={spec.tab}
                active={rightNavExpanded && (activeRightNavTab === spec.tab)}
                title={spec.label}
                onClick={this.handleTabClick(spec.tab)} >
                {spec.label}
                {this.renderTabDecoration(spec.tab)}
              </TabComponent>
            );
          })}
        </TabSetComponent>
        <div
          className={`expanded-area${rightNavExpanded ? " expanded" : ""}`}
          aria-labelledby={this.getTabId(activeRightNavTab as ERightNavTab)}
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
    const tabContents: RightNavTabMap<() => JSX.Element> = {
            [ERightNavTab.kStudentWork]: () => <StudentWorkComponent />,
            [ERightNavTab.kMyWork]: () => <MyWorkComponent />,
            [ERightNavTab.kClassWork]: () => <ClassWorkComponent />,
            [ERightNavTab.kLearningLog]: () => <LearningLogsComponent />,
            [ERightNavTab.kSupports]: () => <SupportsComponent
                                              onToggleExpansion={this.handleToggleSupportsExpansion} />,
          };
    const tabContainers = map(ERightNavTab, (tab: ERightNavTab) => {
            const enabledDisabledClass = activeRightNavTab === tab ? "enabled" : "disabled";
            return (
              this.state.tabLoadAllowed[tab]
                ? <div className={"container " + enabledDisabledClass} key={tab}>
                    {tabContents[tab]()}
                  </div>
                : this.renderLoadingText(tab)
            );
    });

    return (
      <div className="contents">
        {tabContainers}
      </div>
    );
  }

  private renderTabDecoration(tab: ERightNavTab) {
    if (tab === ERightNavTab.kSupports) {
      const {user, supports} = this.stores;
      if (user.isStudent && supports.hasNewTeacherSupports(user.lastSupportViewTimestamp)) {
        return <div className="support-badge" />;
      }
    }
  }

  private renderLoadingText(tab: ERightNavTab) {
    const {activeRightNavTab} = this.stores.ui;
    return (
      <div key={tab}>
        { tab === activeRightNavTab
          ? <div className="loading">loading...</div>
          : null
        }
      </div>
    );
  }

  private handleTabClick = (tab: ERightNavTab) => {
    const { ui } = this.stores;
    const navDoneExpanding = ui.rightNavExpanded;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (!navDoneExpanding) {
        this.setState({navExpanding: true});
      }
      if (tab === ERightNavTab.kSupports) {
        this.updateStudentLastViewSupportTimestamp();
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

  private getTabId(tab: ERightNavTab) {
    return `rightNavTab-${tab}`;
  }

  private handleToggleSupportsExpansion = (section: NavTabSectionModelType) => {
    this.updateStudentLastViewSupportTimestamp();
  }

  private updateStudentLastViewSupportTimestamp = () => {
    const { db, user } = this.stores;
    if (user.isStudent) {
      db.setLastSupportViewTimestamp();
    }
  }

  private updateComponentLoadAllowedState = () => {
    const { ui } = this.stores;
    const tabLoadAllowed = this.state.tabLoadAllowed;
    tabLoadAllowed[ui.activeRightNavTab as ERightNavTab] = true;
    this.setState({ tabLoadAllowed });
  }

}
