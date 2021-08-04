import { inject, observer } from "mobx-react";
import React from "react";
import { EPanelId } from "../../../components/app-header";
import { BaseComponent, IBaseProps } from "../../../components/base";
import { DocumentViewMode } from "../../../components/document/document";
import { FourUpComponent } from "../../../components/four-up";
import { IconButton } from "../../../components/utilities/icon-button";
import { LogEventName, Logger } from "../../../lib/logger";
import { createStickyNote } from "../../../models/curriculum/support";
import { AudienceModel, AudienceEnum } from "../../../models/stores/supports";
import { GroupUserModelType, GroupModelType } from "../../../models/stores/groups";

import "./teacher-group-six-pack-fourup.sass";

interface IProps extends IBaseProps {
  group: GroupModelType;
  row: number;
  column: number;
  documentViewMode: DocumentViewMode;
  selectedSectionId: string | null;
}

interface IState {
  focusedGroupUser: GroupUserModelType | undefined;
}

const ROWS = 2;
const COLUMNS = 3;
export const GROUPS_PER_PAGE = ROWS * COLUMNS;

@inject("stores")
@observer
export class TeacherGroupSixPackFourUp extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      focusedGroupUser: undefined
    };
  }

  public render() {
    const { focusedGroupUser } = this.state;
    const { documentViewMode, selectedSectionId, group, row, column } = this.props;

    interface IGroupRecord {
      id: string;
    }
    interface IGroupHeaderProps {
      group: IGroupRecord;
      focusedGroupUser?: GroupUserModelType;
    }
    const TeacherGroupHeader = (props: IGroupHeaderProps) => {
      const { ui, db }  = this.stores;

      const messageClickHandler = () => {
        if (focusedGroupUser) {
          ui.prompt(`Enter your message for ${focusedGroupUser.name}`, "", `Message ${focusedGroupUser.name}`, 5)
          .then((message) => {
            const audience = AudienceModel.create({type: AudienceEnum.user, identifier: focusedGroupUser.id});
            db.createSupport(createStickyNote(message), "", audience);
            Logger.log(LogEventName.CREATE_STICKY_NOTE, {
              type: "user",
              targetUserId: focusedGroupUser.id,
              text: message
            });
          });
        }
        else {
          ui.prompt(`Enter your message for Group ${props.group.id}`, "", "Message Group", 5)
          .then((message) => {
            const audience = AudienceModel.create({type: AudienceEnum.group, identifier: props.group.id});
            db.createSupport(createStickyNote(message), "", audience);
            Logger.log(LogEventName.CREATE_STICKY_NOTE, {
              type: "group",
              targetGroupId: props.group.id,
              text: message
            });
          });
        }
      };

      const showGroupSupportClickHandler = () => {
        Logger.log(LogEventName.VIEW_GROUP, {group: group.id, via: "dashboard-show-comparison-group"});
        ui.setTeacherPanelKey(EPanelId.workspace);
        ui.setActiveStudentGroup(group.id);
        ui.setDividerPosition(50);
      };

      return(
        <div className="group-header">
          <div className="group-label">Group {String(group.id)}</div>
          <div className="actions">
            <IconButton
              title={`Message ${focusedGroupUser ? focusedGroupUser.name : "Group"}`}
              className="icon"
              icon="sticky-note"
              key={`sticky-note-${focusedGroupUser ? `user-${focusedGroupUser.id}` : "group"}`}
              onClickButton={messageClickHandler} />
            <IconButton
              title="Support"
              className="icon"
              icon="support"
              key="support"
              onClickButton={showGroupSupportClickHandler} />
          </div>
        </div>
      );
    };

    return (
      <div className={`teacher-group group-${row}-${column}`} key={`group-${row}-${column}`}>
        <TeacherGroupHeader group={ group } focusedGroupUser={focusedGroupUser} />
        <div className="teacher-group-canvas-container">
          <div className="teacher-group-canvas">
            <FourUpComponent
              groupId={group.id}
              isGhostUser={true}
              toggleable={true}
              documentViewMode={documentViewMode}
              selectedSectionId={selectedSectionId}
              viaTeacherDashboard={true}
              setFocusedGroupUser={this.setFocusedGroupUser}
            />
          </div>
        </div>
      </div>
    );
  }

  private setFocusedGroupUser = (focusedGroupUser?: GroupUserModelType) => {
    this.setState({focusedGroupUser});
  }
}
