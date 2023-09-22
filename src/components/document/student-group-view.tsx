import React, { useEffect } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { GroupModelType, GroupUserModelType } from "../../models/stores/groups";
import { useProblemStore, useStores } from "../../hooks/use-stores";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { FourUpComponent, getFocusedGroupUser, getQuadrant } from "../four-up";
import { DocumentViewMode } from "./document";

import "./student-group-view.scss";

export const StudentGroupView:React.FC = observer(function StudentGroupView(){
  const stores = useStores();
  const { groups, ui } = stores;

  useEffect(() => stores.initializeStudentWorkTab(), [stores]);

  const selectedGroupId = ui.tabs.get("student-work")?.openSubTab || "";
  const group = groups.getGroupById(selectedGroupId);
  const openDocId = ui.tabs.get("student-work")?.openDocuments.get(selectedGroupId);
  const focusedGroupUser = getFocusedGroupUser(group, openDocId, DocumentViewMode.Live);
  const isChatPanelShown = ui.showChatPanel;
  const documentSelectedForComment = ui.showChatPanel && ui.selectedTileIds.length === 0 && ui.focusDocument;
  const studentGroupViewClasses = classNames( "editable-document-content", "document", "student-group-view",
    { "chat-open": isChatPanelShown }, { "comment-select" : documentSelectedForComment });

  return (
    <div key="student-group-view" className={studentGroupViewClasses}>
      <GroupViewTitlebar group={group} groupUser={focusedGroupUser} />
      <GroupTitlebar group={group} groupUser={focusedGroupUser} />
      <div className="canvas-area">
        { group &&
          <FourUpComponent group={group}
                         isGhostUser={true}
                         viaStudentGroupView={true}
          />
        }
      </div>
    </div>
  );
});

interface IGroupComponentProps {
  group?: GroupModelType;
  groupUser?: GroupUserModelType;
}

const GroupViewTitlebar: React.FC<IGroupComponentProps> = observer(function GroupViewTitlebar({ group, groupUser }) {
  const { groups, ui } = useStores();
  const focusedGroupUser = groupUser;

  const handleFocusedUserChange = (selectedUser: GroupUserModelType) => {
    group?.id && selectedUser.problemDocument &&
      ui.openSubTabDocument("student-work", group.id, selectedUser.problemDocument.key);
  };

  const handleSelectGroup = (id: string) => {
    ui.setOpenSubTab("student-work", id);
    ui.closeSubTabDocument("student-work", id);
    Logger.log(LogEventName.VIEW_GROUP, { group: id, via: "group-document-titlebar" });
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
                                              { focused: u.id === focusedGroupUser.id }
                                              );
              return (
                <button key={u.name} className={className} title={u.name}
                    onClick={()=>handleFocusedUserChange(u)}>
                  {u.name}
                </button>
              );
            })}
          </>
        : groups.nonEmptyGroups
            .map(g => {
              return <GroupButton displayId={g.displayId} id={g.id} key={g.id}
                                  selected={g.id === group?.id}
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
const GroupButton: React.FC<IGroupButtonProps> = (props) => {
  const { displayId, id, selected, onSelectGroup } = props;
  const className = `icon group-number ${selected ? "active" : ""}`;
  const handleClick = () => onSelectGroup && onSelectGroup(id);
  return(
    <div key={`group-${id}`} className={className} onClick={handleClick}>
      <div className="number">G{displayId}</div>
    </div>
  );
};

const GroupTitlebar: React.FC<IGroupComponentProps> = observer(function GroupTitlebar({ group, groupUser }) {
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
