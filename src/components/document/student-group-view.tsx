import React, { useState } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { getGroupUsers } from "../../models/document/document-utils";
import { GroupUserModelType } from "../../models/stores/groups";
import { useProblemStore, useUIStore, useStores } from "../../hooks/use-stores";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { FourUpComponent, FourUpUser } from "../four-up";

import "./student-group-view.scss";

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

interface IGroupViewTitlebarProps {
  selectedId?: string;
  onSelectGroup: (id: string) => void;
}

interface IGroupTitlebarProps {
  selectedId: string;
  groupUser?: GroupUserModelType | undefined;
}

interface IProps {
  // groupId?: string;
  // setGroupId: (groupId: string) => void;
}

//Scott's comments
// don't pass groupId and setGroupId as props to StudentGroupView

// StudentGroupView gets the ui store and then sets selectedGroupId = ui.tabs.get("student-work").openSubTab
//to figure out which group it should display.

// handleSelectGroup calls ui.setOpenSubTab("student-work", id) and uui.closeSubTabDocument("student-work", id)

// the focusedGroupUser is computed from openDoc = ui.tabs.get("student-work").openDocuments.get(selectedGroupId)
//then the id of the openDoc is looked for in groupsUsers the user with this document is the focusedGroupUser
//when a user is selected in the 4up or in the top bar then ui.openSubTabDocument("student-work", selectedGroupId, documentId)
// is called with the documentId of the user that was clicked on

// private selectStudentGroup = (groupId: string) => {
//   const { ui } = this.stores;
//   ui.setActiveStudentGroup(groupId);
// };



export const StudentGroupView:React.FC<IProps> = observer(function StudentGroupView(){
  console.log("-------<StudentGroupView>-------");

  const {user, groups, documents} = useStores();
  const ui = useUIStore();
  console.log("\tui:", ui);

  // const [focusedGroupUser, setFocusedGroupUser] = useState<GroupUserModelType | undefined>();
  // const selectedGroupId = groupId || (groups.allGroups.length ? groups.allGroups[0].id : "");
  const selectedGroupId = ui.tabs.get("student-work")?.openSubTab ||
                          (groups.allGroups.length ? groups.allGroups[0].id : "");
  console.log("\tselectedGroupId:", selectedGroupId);
  const groupUsers = getGroupUsers(user.id, groups, documents, selectedGroupId);
  const group = groups.getGroupById(selectedGroupId);
  console.log("\tgroupUsers:", groupUsers);
  const openDocId = ui.tabs.get("student-work")?.openDocuments.get(selectedGroupId);
  console.log("\topenDocId:", openDocId);
  console.log("getStudentWork:", ui.tabs.get("student-work"));
  const focusedGroupUser = groupUsers.find(obj => obj.doc?.key === openDocId)?.user;
  console.log("\tfocusedGroupUser:", focusedGroupUser);
  const isStudentViewActiveTab = (ui.activeNavTab === "student-work");
  const isChatPanelShown = ui.showChatPanel;
  const shrinkStudentView  = isStudentViewActiveTab && isChatPanelShown;
  const documentSelectedForComment = ui.showChatPanel && ui.selectedTileIds.length === 0 && ui.focusDocument;
  const studentGroupViewClasses = classNames( "editable-document-content", "document", "student-group-view",
  {"shrink-student-view": shrinkStudentView}, {"comment-select" : documentSelectedForComment});

  if (focusedGroupUser && isStudentViewActiveTab){
    const id = focusedGroupUser.id;
    const foundUser = groupUsers.find(obj => obj.user.id === id);
    if (foundUser && foundUser.doc && foundUser.doc.key && foundUser.doc.groupId){
      //use group buttons (G1, G2, etc) as a pseudo subTab
      const groupSubTab = foundUser.doc.groupId;
      const documentKey = foundUser.doc.key;
      console.log("groupSubTab:", groupSubTab);
      console.log("documentKey:", documentKey);

      // ui.openSubTabDocument("student-work", groupSubTab, documentKey);
    }
  }

  const handleSelectGroup = (id: string) => {
    console.log("handleSelectGroup with id:", id);
    Logger.log(LogEventName.VIEW_GROUP, {group: id, via: "group-document-titlebar"});
    // setGroupId(id);
    ui.setOpenSubTab("student-work", id);
    ui.closeSubTabDocument("student-work", id);
    // setFocusedGroupUser(undefined);
  };

  const handleFocusedUserChange = (selectedUser: FourUpUser) => {
    // setFocusedGroupUser(selectedUser.user);
  };

  const GroupViewTitlebar: React.FC<IGroupViewTitlebarProps> = ({ selectedId, onSelectGroup }) => {
    return (
      <div className={`titlebar student-group group`}>
        <div className="actions">
        {focusedGroupUser && group
          ? <>
              <GroupButton displayId={group.displayId} id={group.id} key={group.id}
                            selected={group.id === selectedId}
              />
              { groupUsers.map(u => {
                  const className = classNames("member-button", "in-student-group-view", u.context,
                                                // {focused: u.user.id === focusedGroupUser.id}
                                                );
                return (
                  <button key={u.user.name} className={className} title={u.user.name}
                      onClick={()=>handleFocusedUserChange(u)}>
                    {u.user.name}
                  </button>
                );
              })}
            </>
          : groups.allGroups
              .filter(g => g.users.length > 0)
              .map(g => {
                return <GroupButton displayId={g.displayId} id={g.id} key={g.id}
                                    selected={g.id === selectedId}
                                    onSelectGroup={onSelectGroup} />;
              })
          }
        </div>
      </div>
    );
  };

  const GroupTitlebar: React.FC<IGroupTitlebarProps> = ({groupUser}) => {
    const problem = useProblemStore();
    const userInfo = groupUsers.find(gUser => gUser.user.id === groupUser?.id);
    const userDocTitle = userInfo?.doc?.title || "Document";
    const titleText = focusedGroupUser && groupUser && userInfo
                        ? `${groupUser.name}: ${userInfo.doc?.type === "problem" ? problem.title : userDocTitle}`
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
  };

  const focusedUserContext = (groupUsers.find(u => u.user.id === focusedGroupUser?.id))?.context;

  return (
    <div key="student-group-view" className={studentGroupViewClasses}>
      <GroupViewTitlebar selectedId={selectedGroupId} onSelectGroup={handleSelectGroup} />
      <GroupTitlebar selectedId={selectedGroupId}
                     groupUser={focusedGroupUser}/>
      <div className="canvas-area">
        <FourUpComponent groupId={selectedGroupId}
                         isGhostUser={true}
                         viaStudentGroupView={true}
                         focusedUserContext={focusedUserContext}
                        //  setFocusedGroupUser={setFocusedGroupUser}
        />
      </div>
    </div>
  );
});
