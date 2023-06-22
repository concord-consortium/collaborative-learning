import React, { useState } from "react";
import classNames from "classnames";
import { GroupUserModelType } from "../../models/stores/groups";
import { useGroupsStore, useUIStore, useUserStore } from "../../hooks/use-stores";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { FourUpComponent } from "../four-up";

import "./student-group-view.scss";
import { group } from "d3";

interface IGroupButtonProps {
  displayId: string;
  id: string;
  selected: boolean;
  onSelectGroup: (id: string) => void;
}
const GroupButton: React.FC<IGroupButtonProps> = ({ displayId, id, selected, onSelectGroup }) => {
  const className = `icon group-number ${selected ? "active" : ""}`;
  const handleClick = () => onSelectGroup(id);
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
  context: string | null;
  groupUser?: GroupUserModelType | undefined;
}

interface IProps {
  groupId?: string;
  setGroupId: (groupId: string) => void;
}
export const StudentGroupView:React.FC<IProps> = ({ groupId, setGroupId }) => {
  console.log("<----StudentGroupView---->");
  console.log("\tgroupId:", groupId);
  // console.log("\tsetGroupId:", setGroupId);
  const user = useUserStore();
  const groups = useGroupsStore();
  const [focusedGroupUser, setFocusedGroupUser] = useState<GroupUserModelType | undefined>();
  const [groupViewContext, setGroupViewContext] = useState<string | null>(null);
  const selectedGroupId = groupId || (groups.allGroups.length ? groups.allGroups[0].id : "");

  const ui = useUIStore();
  const isStudentViewActiveTab = (ui.activeNavTab === "student-work");
  const isChatPanelShown = ui.showChatPanel;
  const shrinkStudentView  = isStudentViewActiveTab && isChatPanelShown;
  const classes = classNames("document", "student-group-view", {"shrink-student-view": shrinkStudentView});

  const handleSelectGroup = (id: string) => {
    console.log("\t🔨handleSelectGroup with id:",id);
    Logger.log(LogEventName.VIEW_GROUP, {group: id, via: "group-document-titlebar"});
    setGroupId(id);
    setFocusedGroupUser(undefined);
    setGroupViewContext(null);
  };
  const handleFocusedGroupUserChange = (selectedGroupUser: GroupUserModelType | undefined) => {
    console.log("\t🔨handleFocusedGroupUserChange with selectedGroupUser:", selectedGroupUser);
    setFocusedGroupUser(selectedGroupUser);
  };
  const handleToggleContext = (context: string | null, selectedGroupUser: GroupUserModelType | undefined) => {
    setGroupViewContext(context);
    setFocusedGroupUser(selectedGroupUser);
  };
  const GroupViewTitlebar: React.FC<IGroupViewTitlebarProps> = ({ selectedId, onSelectGroup }) => {
    return (
      <div className={`titlebar student-group group`}>
        <div className="actions">
          { groups.allGroups
              .filter(group => group.users.length > 0)
              .map(group => {
                return <GroupButton displayId={group.displayId} id={group.id} key={group.id}
                                    selected={group.id === selectedId}
                                    onSelectGroup={onSelectGroup} />;
              })}
        </div>
      </div>
    );
  };
  const GroupTitlebar: React.FC<IGroupTitlebarProps> = ({selectedId, context, groupUser}) => {
    return (
      <div className="group-title" data-test="group-title">
        <div className="group-title-center">
          <div className="group-name">
            {selectedId ? `Student Group ${selectedId}` : "No groups"}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div key="student-group-view" className={classes}>
      <GroupViewTitlebar selectedId={selectedGroupId} onSelectGroup={handleSelectGroup} />
      <GroupTitlebar selectedId={selectedGroupId} context={groupViewContext} groupUser={focusedGroupUser}/>
      <div className="canvas-area">
        <FourUpComponent userId={user.id}
                         groupId={selectedGroupId}
                         isGhostUser={true}
                         viaStudentGroupView={true}
                         groupViewContext={groupViewContext}
                         setFocusedGroupUser={handleFocusedGroupUserChange}
                         onToggleContext={handleToggleContext}
        />
      </div>
    </div>
  );
};
