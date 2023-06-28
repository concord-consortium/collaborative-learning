import { inject, observer, useLocalObservable } from "mobx-react";
import { computed } from "mobx";
import React from "react";
import { useStores } from "../../../hooks/use-stores";
import { BaseComponent, IBaseProps } from "../../../components/base";
import { DocumentViewMode } from "../../../components/document/document";
import { FourUpComponent } from "../../../components/four-up";
import { IconButton } from "../../../components/utilities/icon-button";
import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { createStickyNote } from "../../../models/curriculum/support";
import { AudienceModel, AudienceEnum } from "../../../models/stores/supports";
import { GroupUserModelType, GroupModelType } from "../../../models/stores/groups";
import { getGroupUsers } from "../../../models/document/document-utils";

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
  }

  public render() {
    const { documentViewMode, selectedSectionId, group, row, column } = this.props;
    console.log("TeacherGroupSixPackFourUp");
    console.log("\tgroup:", group);
    console.log("\tselectedSectionId:", selectedSectionId);

    return (
      <div className={`teacher-group group-${row}-${column}`} key={`group-${row}-${column}`}>
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
              setFocusedGroupUser={this.setFocusedGroupUser}
            />
          </div>
        </div>
      </div>
    );
  }

  private setFocusedGroupUser = (focusedGroupUser?: GroupUserModelType) => {
    const {ui} = this.stores;
    ui.setOpenSubTab("student-work", this.props.group.id);
  };
}

interface IGroupRecord {
  id: string;
}
interface IGroupHeaderProps {
  group: IGroupRecord;
}

const TeacherGroupHeader: React.FC<IGroupHeaderProps> = observer(function TeacherGroupHeader({group}){
  const { ui, db, user, groups, documents }  = useStores();

  // console.log("\tgroups:",groups);


  const localObservable = useLocalObservable(() => ({
    get groupUsers() {
      return getGroupUsers(user.id, groups, documents, group.id);
    }
  }), {groupUsers: computed.struct});

  const { groupUsers } = localObservable;

  // When we have a valid selectedGroupId
  // Then set the active group (openSubTab) to be this group
  // MobX `when` will only run one time, so this won't keep updating the openSubTab.
  // If the user somehow changes the openSubTab before all of the groups are loaded,
  // this will just set the openSubTab to be the same value it already is.

  const openDocId = ui.tabs.get("student-work")?.openDocuments.get(group.id);
  if(group.id === "1"){
    console.log("<TeacherGroupHeader>---");
    console.log("\tgroupUsers:", groupUsers);
  }

  const focusedGroupUser = groupUsers.find(obj => obj.doc?.key === openDocId)?.user;

  const messageClickHandler = () => {

    console.log("in message clickhandler focusedGroupUser:", focusedGroupUser);
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
      console.log("else line 121 groupId:", group.id);
      ui.prompt(`Enter your message for Group ${group.id}`, "", "Message Group", 5)
      .then((message) => {
        console.log("then block:", message);
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
      <div className="group-label">Group {String(group.id)}</div>
      <div className="actions">
        <IconButton
          title={`Message ${focusedGroupUser ? focusedGroupUser.name : "Group"}`}
          className="icon"
          icon="sticky-note"
          key={`sticky-note-${focusedGroupUser ? `user-${focusedGroupUser.id}` : "group"}`}
          onClickButton={messageClickHandler} />
      </div>
    </div>
  );
});
