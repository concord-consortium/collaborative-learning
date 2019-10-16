import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { FourUpComponent } from "../four-up";
import { IconButton } from "../utilities/icon-button";
import "./teacher-group-six-pack.sass";
import { DocumentViewMode } from "./teacher-group-tab";
import { GroupVirtualDocument } from "../../models/document/group-virtual-document";
import { EPanelId } from "../../clue/components/clue-app-content";
interface IProps extends IBaseProps {
  page: number;
  documentViewMode: DocumentViewMode;
  selectedSectionId: string | null;
}

const ROWS = 2;
const COLUMNS = 3;
export const GROUPS_PER_PAGE = ROWS * COLUMNS;

@inject("stores")
@observer
export class TeacherGroupSixPack extends BaseComponent<IProps, {}> {

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
    const { documentViewMode, selectedSectionId } = this.props;
    const { groups } = this.stores;
    const group = groups.allGroups[groupIndex];

    interface IGroupRecord {
      id: string;
    }
    interface IGroupHeaderProps {
      group: IGroupRecord;
    }
    const TeacherGroupHeader = (props: IGroupHeaderProps) => {
      const { ui }  = this.stores;

      const showGroupClickHandler = () => {
        ui.problemWorkspace.setComparisonDocument(new GroupVirtualDocument(group));
        ui.problemWorkspace.toggleComparisonVisible({override: true});
        ui.setTeacherPanelKey(EPanelId.workspace);
      };

      const showGroupSupportClickHandler = () => {
        ui.problemWorkspace.setComparisonDocument(new GroupVirtualDocument(group));
        ui.problemWorkspace.toggleComparisonVisible({override: true});
        ui.setTeacherPanelKey(EPanelId.workspace);
      };

      return(
        <div className="group-header">
          <div className="group-label">Group {String(group.id)}</div>
          <div className="actions">
            <IconButton
              className="icon"
              icon="support"
              key="support"
              onClickButton={showGroupSupportClickHandler} />
            <IconButton
              className="icon"
              icon="expand-group-view"
              key="expand-group-view"
              onClickButton={showGroupClickHandler} />
          </div>
        </div>
      );
    };

    return (
      <div className={`teacher-group group-${r}-${c}`} key={`group-${r}-${c}`}>
        <TeacherGroupHeader group={ group } />
        <div className="teacher-group-canvas-container">
          <div className="teacher-group-canvas">
            <FourUpComponent
              groupId={group.id}
              isGhostUser={true}
              toggleable={true}
              documentViewMode={documentViewMode}
              selectedSectionId={selectedSectionId}
              viaTeacherDashboard={true}
            />
          </div>
        </div>
      </div>
    );
  }
}
