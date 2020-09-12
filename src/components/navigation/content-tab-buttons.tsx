import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { EContentTab, ContentTabSpec } from "../../models/view/content-tabs";
import { Logger, LogEventName } from "../../lib/logger";

import "./content-tab-buttons.sass";

interface IProps extends IBaseProps {
  tabs?: ContentTabSpec[];
  isTeacher: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

interface IState {
  tabLoadAllowed: { [tab: number]: boolean };
}

@inject("stores")
@observer
export class ContentTabButtons extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabLoadAllowed: {},
    };
  }

  public render() {
    const { tabs } = this.props;
    const { ui } = this.stores;
    return (
      <div className={`content-tab-buttons ${ui.contentTabShown ? "hidden" : ""}`}>
        { tabs?.map((tabSpec, i) => {
            const tabClass = `content-tab tab-${tabSpec.tab}`;
            return (
              <div key={tabSpec.tab} className={tabClass} onClick={this.handleTabButtonClick(tabSpec.tab)}>
                {tabSpec.label}
              </div>
            );
          })
        }
      </div>
    );
  }

  private handleTabButtonClick = (tab: EContentTab) => () => {
    const { ui } = this.stores;
    const logParameters = {
      tab_name: tab.toString()
    };
    const logEvent = () => { Logger.log(LogEventName.SHOW_LEFT_TAB, logParameters); };
    if (ui.activeContentTab !== tab) {
      ui.setActiveContentTab(tab);
      logEvent();
    }
    ui.toggleContentTab(true);
  }

}
