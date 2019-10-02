import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { FourUpComponent } from "../four-up";
import { IconButton } from "../utilities/icon-button";
import { PanelType, PanelTypeEnum } from "../../models/stores/ui";
import "./teacher-group-six-pack.sass";

interface IProps extends IBaseProps {
  page: number;
}

interface IState { }

const ROWS = 2;
const COLUMNS = 3;
export const GROUPS_PER_PAGE = ROWS * COLUMNS;

@inject("stores")
@observer
export class TeacherGroupSixPack extends BaseComponent<IProps, IState> {

  public render() {
    return (
      <div className="teacher-group-six-pack">
        {this.renderGroups()}
      </div>
    );
  }

  private renderGroups() {
    const { page } = this.props;
    const { groups } = this.stores;
    const numberOfGroups = groups.allGroups.length;
    const renders = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLUMNS; c++) {
        const groupIndex = (page * GROUPS_PER_PAGE) + (r * COLUMNS) + c;
        if (groupIndex < numberOfGroups) {
          renders.push(this.renderFourUp(groupIndex, r, c));
        }
      }
    }
    return renders;
  }

  private renderFourUp(groupIndex: number, r: number, c: number) {
    const { groups, ui, user } = this.stores;
    const group = groups.allGroups[groupIndex];

    interface IGroupRecord {
      id: string;
    }
    interface IGroupHeaderProps {
      group: IGroupRecord;
    }
    const TeacherGroupHeader = (props: IGroupHeaderProps) => {
      const { group: g} = props;
      const clickHandler = () => {
        console.log("click");
        // ui.set
        groups.ghostGroup(user.id, g.id);
        ui.setCurrentPanel("dashboardFourUp");
      };
      return(
        <div className="group-header">
          <div className="group-label">Group {String(g.id)}</div>
          <IconButton
            icon="expand-group-view"
            key="expand-group-view"
            className="action icon-expand-group-view"
            onClickButton={clickHandler} />
        </div>
      );
    };

    return (
      <div className={`teacher-group group-${r}-${c}`} key={`group-${r}-${c}`}>
        <TeacherGroupHeader group={ group } />
        <div className="teacher-group-canvas-container">
          <div className="teacher-group-canvas">
            <FourUpComponent groupId={group.id} isGhostUser={true} toggleable={true} />
          </div>
        </div>
      </div>
    );
  }
}
