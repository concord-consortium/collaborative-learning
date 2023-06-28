import React, { useEffect } from "react";
import { computed, when } from "mobx";
import { observer, useLocalObservable } from "mobx-react";
import classNames from "classnames";
import { getGroupUsers } from "../../models/document/document-utils";
import { GroupUserModelType } from "../../models/stores/groups";
import { useProblemStore, useStores } from "../../hooks/use-stores";
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

interface IProps {}

export const StudentGroupView:React.FC<IProps> = observer(function StudentGroupView(){
  console.log("StudentGroupView render");
  const {user, groups, documents, ui} = useStores();

  // Use a local observable so selectedGroupId and groupUsers are cached and
  // only cause re-renders if their value would actually change after the
  // objects they are using have changed. The user, groups, and documents could
  // change. Currently it is the documents which change the most as all of the
  // documents are loaded in.
  //
  // Note: a structural comparison is required for groupUsers since it returns a
  // new array each time it is called. So without a structural comparison the
  // object will be different each time a new document is loaded. Because this
  // structural comparison is necessary this approach is in-efficient.  It'd be
  // better to refactor getGroupUsers, so the groupUsers are part of the global
  // store and are updated (instead of recreated) as needed.
  const localObservable = useLocalObservable(() => ({
    get selectedGroupId() {
      return ui.tabs.get("student-work")?.openSubTab
        || (groups.allGroups.length ? groups.allGroups[0].id : "");
    },
    get groupUsers() {
      return getGroupUsers(user.id, groups, documents, this.selectedGroupId);
    }
  }), {groupUsers: computed.struct});

  const { groupUsers, selectedGroupId } = localObservable;

  // When we have a valid selectedGroupId
  // Then set the active group (openSubTab) to be this group
  // MobX `when` will only run one time, so this won't keep updating the openSubTab.
  // If the user somehow changes the openSubTab before all of the groups are loaded,
  // this will just set the openSubTab to be the same value it already is.
  useEffect(() => when(
    () => localObservable.selectedGroupId !== "",
    () => ui.setOpenSubTab("student-work", localObservable.selectedGroupId)
  ), [localObservable, ui]);

  const group = groups.getGroupById(selectedGroupId);
  const openDocId = ui.tabs.get("student-work")?.openDocuments.get(selectedGroupId);
  const focusedGroupUser = groupUsers.find(obj => obj.doc?.key === openDocId)?.user;
  const isStudentViewActiveTab = (ui.activeNavTab === "student-work");
  const isChatPanelShown = ui.showChatPanel;
  const shrinkStudentView  = isStudentViewActiveTab && isChatPanelShown;
  const documentSelectedForComment = ui.showChatPanel && ui.selectedTileIds.length === 0 && ui.focusDocument;
  const studentGroupViewClasses = classNames( "editable-document-content", "document", "student-group-view",
  {"shrink-student-view": shrinkStudentView}, {"comment-select" : documentSelectedForComment});

  const handleSelectGroup = (id: string) => {
    Logger.log(LogEventName.VIEW_GROUP, {group: id, via: "group-document-titlebar"});
    ui.setOpenSubTab("student-work", id);
    ui.closeSubTabDocument("student-work", id);
  };

  const handleFocusedUserChange = (selectedUser: FourUpUser) => {
    selectedUser.doc && ui.openSubTabDocument("student-work", selectedGroupId, selectedUser.doc.key);
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
                                                {focused: u.user.id === focusedGroupUser.id}
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
        />
      </div>
    </div>
  );
});
