import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { FourUpComponent } from "../../components/four-up";
import "./teacher-dashboard-four-up.sass";
interface IProps {}
interface IState {}

@inject("stores")
@observer
export class TeacherDashboardFourUpComponent extends BaseComponent<IProps, IState> {

  public render() {
    const { groups } = this.stores;
    const { ghostGroupId } = groups;
    console.log(ghostGroupId);
    return (
      <div className="teacher-dashboard-four-up">
        {/* <div className="tabbed-area">
          <div className="tab-contents" aria-labelledby={this.getTabId(activeTab)}>
            {this.renderTabContents()}
          </div>
        </div> */}
        Hi Mom {ghostGroupId}
        <div className="teacher-group-canvas-container">
          <div className="teacher-group-canvas">
            <FourUpComponent groupId={ghostGroupId} isGhostUser={true} toggleable={true} />
          </div>
        </div>
      </div>
    );
  }

  // private renderTabContents() {
  //   switch (this.state.activeTab.type) {
  //     case "Groups":
  //       return (
  //         <div className="contents">
  //           <TeacherGroupTabComponent />
  //         </div>
  //       );
  //     case "Students":
  //       return (
  //         <div className="contents">
  //           <TeacherStudentTabComponent />
  //         </div>
  //       );
  //     case "Supports":
  //       return (
  //         <div className="contents">
  //           TBD: Supports
  //         </div>
  //       );
  //   }
  // }

  // private getTabId(tab: TabInfo) {
  //   return `teacher-dashboard-${tab.id}`;
  // }
}
