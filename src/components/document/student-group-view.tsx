import React, { useEffect } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { GroupModelType, GroupUserModelType } from "../../models/stores/groups";
import { useProblemStore, useStores } from "../../hooks/use-stores";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { FourUpComponent } from "../four-up";

import "./student-group-view.scss";

export const StudentGroupView:React.FC = observer(function StudentGroupView(){
  const stores = useStores();
  const {groups, ui } = stores;

  useEffect(() => stores.initializeStudentWorkTab(), [stores]);

  const selectedGroupId = ui.tabs.get("student-work")?.openSubTab || "";
  const group = groups.getGroupById(selectedGroupId);
  const openDocId = ui.tabs.get("student-work")?.openDocuments.get(selectedGroupId);
  const focusedGroupUser = group?.users.find(obj => obj.problemDocument?.key === openDocId);
  const isStudentViewActiveTab = (ui.activeNavTab === "student-work");
  const isChatPanelShown = ui.showChatPanel;
  const shrinkStudentView  = isStudentViewActiveTab && isChatPanelShown;
  const documentSelectedForComment = ui.showChatPanel && ui.selectedTileIds.length === 0 && ui.focusDocument;
  const studentGroupViewClasses = classNames( "editable-document-content", "document", "student-group-view",
  {"shrink-student-view": shrinkStudentView}, {"comment-select" : documentSelectedForComment});

  const focusedUserIndex = focusedGroupUser && group?.sortedUsers.indexOf(focusedGroupUser);
  const focusedUserQuadrant = focusedUserIndex === undefined ? undefined : getQuadrant(focusedUserIndex);

  return (
    <div key="student-group-view" className={studentGroupViewClasses}>
      <GroupViewTitlebar />
      <GroupTitlebar group={group} groupUser={focusedGroupUser} />
      <div className="canvas-area">
        <FourUpComponent groupId={selectedGroupId}
                         isGhostUser={true}
                         viaStudentGroupView={true}
                         focusedUserContext={focusedUserQuadrant}
        />
      </div>
    </div>
  );
});

const GroupViewTitlebar: React.FC = observer(function GroupViewTitlebar() {
  const {groups, ui} = useStores();
  const groupId = ui.tabs.get("student-work")?.openSubTab;
  const group = groups.getGroupById(groupId);
  const openDocId = ui.tabs.get("student-work")?.openDocuments.get(groupId || "");
  const focusedGroupUser = group?.users.find(obj => obj.problemDocument?.key === openDocId);

  const handleFocusedUserChange = (selectedUser: GroupUserModelType) => {
    groupId && selectedUser.problemDocument &&
      ui.openSubTabDocument("student-work", groupId, selectedUser.problemDocument.key);
  };

  const handleSelectGroup = (id: string) => {
    ui.setOpenSubTab("student-work", id);
    ui.closeSubTabDocument("student-work", id);
    Logger.log(LogEventName.VIEW_GROUP, {group: id, via: "group-document-titlebar"});
  };

  return (
    <div className={`titlebar student-group group`}>
      <div className="actions">
      {focusedGroupUser && group
        ? <>
            <GroupButton displayId={group.displayId} id={group.id} key={group.id}
                          selected={true}
            />
            { group.sortedUsers.map((u, index) => {
                const className = classNames("member-button", "in-student-group-view", getQuadrant(index),
                                              {focused: u.id === focusedGroupUser.id}
                                              );
              return (
                <button key={u.name} className={className} title={u.name}
                    onClick={()=>handleFocusedUserChange(u)}>
                  {u.name}
                </button>
              );
            })}
          </>
        : groups.allGroups
            .filter(g => g.users.length > 0)
            .map(g => {
              return <GroupButton displayId={g.displayId} id={g.id} key={g.id}
                                  selected={g.id === groupId}
                                  onSelectGroup={handleSelectGroup} />;
            })
        }
      </div>
    </div>
  );
});

interface IGroupButtonProps {
  displayId: string;
  id: string;
  selected: boolean;
  onSelectGroup?: (id: string) => void;
}
const GroupButton: React.FC<IGroupButtonProps> = ({ displayId, id, selected, onSelectGroup }) => {
  const className = `icon group-number ${selected ? "active" : ""}`;
  const handleClick = () => onSelectGroup && onSelectGroup(id);
  return(
    <div key={`group-${id}`} className={className} onClick={handleClick}>
      <div className="number">G{displayId}</div>
    </div>
  );
};

interface IGroupTitlebarProps {
  group?: GroupModelType;
  groupUser?: GroupUserModelType;
}

const GroupTitlebar: React.FC<IGroupTitlebarProps> = observer(function GroupTitlebar({group, groupUser}) {
  const problem = useProblemStore();
  const document= groupUser?.problemDocument;
  const userDocTitle = document?.title || "Document";
  const titleText = groupUser
                      ? `${groupUser.name}: ${document?.type === "problem" ? problem.title : userDocTitle}`
                      : group?.displayId ? `Student Group ${group?.displayId}` : "No groups";
  return (
    <div className="group-title" data-test="group-title">
      <div className="group-title-center">
        <div className="group-name">
          {titleText}
        </div>
      </div>
    </div>
  );
});

const quadrants: Array<string | undefined> = [ "four-up-nw", "four-up-ne", "four-up-se", "four-up-sw"];
function getQuadrant(groupUserIndex: number) {
  return quadrants[groupUserIndex];
}
