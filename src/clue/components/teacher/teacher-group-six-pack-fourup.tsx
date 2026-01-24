import { inject, observer } from "mobx-react";
import React from "react";
import { useStores } from "../../../hooks/use-stores";
import { BaseComponent, IBaseProps } from "../../../components/base";
import { DocumentViewMode } from "../../../components/document/document";
import { FourUpComponent, getFocusedGroupUser, getUIStudentWorkTab } from "../../../components/four-up";
import { IconButton } from "../../../components/utilities/icon-button";
import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { createStickyNote } from "../../../models/curriculum/support";
import { AudienceModel, AudienceEnum } from "../../../models/stores/supports";
import { GroupUserModelType, GroupModelType } from "../../../models/stores/groups";

import "./teacher-group-six-pack-fourup.scss";

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
  }

  public render() {
    const { documentViewMode, selectedSectionId, group, row, column } = this.props;

    return (
      <div className={`teacher-group group-${row}-${column}`} key={`group-${row}-${column}`}>
        <TeacherGroupHeader
          group={ group }
          navTabName={this.getNavTabName()}
          documentViewMode={documentViewMode}
        />
        <div className="teacher-group-canvas-container">
          <div className="teacher-group-canvas">
            <FourUpComponent
              group={group}
              isGhostUser={true}
              documentViewMode={documentViewMode}
              selectedSectionId={selectedSectionId}
              viaTeacherDashboard={true}
            />
          </div>
        </div>
      </div>
    );
  }

/**
 * When the dashboard is showing published documents, we use a fake tab called
 * student-work-published to keep track of which documents are open. This
 * corresponds the focused user.
 *
 * @returns
 */
  private getNavTabName() {
    return getUIStudentWorkTab(this.props.documentViewMode);
  }
}

interface IGroupRecord {
  id: string;
}
interface IGroupHeaderProps {
  group: IGroupRecord;
  navTabName: string;
  documentViewMode?: DocumentViewMode
}

const TeacherGroupHeader: React.FC<IGroupHeaderProps> = observer(function TeacherGroupHeader(
    {group, navTabName, documentViewMode}){
  const { appConfig, ui, persistentUI, db, groups, user: { isResearcher } }  = useStores();

  const openDocId = persistentUI.tabs.get(navTabName)?.getDocumentGroup(group.id)?.primaryDocumentKey;
  const groupModel = groups.getGroupById(group.id);
  const focusedGroupUser = getFocusedGroupUser(groupModel, openDocId, documentViewMode);

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
      const groupLabel = appConfig.getCustomLabel("Group");
      ui.prompt(`Enter your message for ${groupLabel} ${group.id}`, "", `Message ${groupLabel}`, 5)
      .then((message) => {
        const audience = AudienceModel.create({type: AudienceEnum.group, identifier: group.id});
        db.createSupport(createStickyNote(message), "", audience);
        Logger.log(LogEventName.CREATE_STICKY_NOTE, {
          type: "group",
          targetGroupId: group.id,
          text: message
        });
      });
    }
  };


  return(
    <div className="group-header">
      <div className="group-label">{appConfig.getCustomLabel("Group")} {String(group.id)}</div>
      <div className="actions">
        {!isResearcher && <IconButton
          title={`Message ${focusedGroupUser ? focusedGroupUser.name : appConfig.getCustomLabel("Group")}`}
          className="icon"
          icon="sticky-note"
          key={`sticky-note-${focusedGroupUser ? `user-${focusedGroupUser.id}` : "group"}`}
          onClickButton={messageClickHandler} />}
      </div>
    </div>
  );
});
