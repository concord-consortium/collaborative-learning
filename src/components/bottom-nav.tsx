import { inject, observer } from "mobx-react";
import * as React from "react";

import "./bottom-nav.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";
import { LearningLogComponent } from "./learning-log";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class BottomNavComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { bottomNavExpanded } = this.stores.ui;
    const className = `bottom-nav${bottomNavExpanded ? " expanded" : ""}`;
    return (
      <div className={className}>
        <TabSetComponent>
          <TabComponent id="learningLogTab" active={bottomNavExpanded} onClick={this.handleClick}>
            Learning Log
          </TabComponent>
        </TabSetComponent>
        <div className="expanded-area" aria-labelledby="learningLogTab" aria-hidden={!bottomNavExpanded}>
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

}
