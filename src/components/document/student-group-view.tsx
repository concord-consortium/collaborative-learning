import React, { useState } from "react";
import { GroupUserModelType } from "src/models/stores/groups";
import { useGroupsStore, useUserStore } from "../../hooks/use-stores";
import { LogEventName, Logger } from "../../lib/logger";
import { FourUpComponent } from "../four-up";
import FourUpIcon from "../../clue/assets/icons/4-up-icon.svg";
import "./student-group-view.scss";

interface IGroupButtonProps {
  id: string;
  selected: boolean;
  onSelectGroup: (id: string) => void;
}
const GroupButton: React.FC<IGroupButtonProps> = ({ id, selected, onSelectGroup }) => {
  const className = `icon group-number ${selected ? "active" : ""}`;
  const handleClick = () => onSelectGroup(id);
  return(
    <div key={`group-${id}`} className={className} onClick={handleClick}>
      <div className="number">G{id}</div>
    </div>
  );
};

interface IGroupViewTitlebarProps {
  selectedId?: string;
  onSelectGroup: (id: string) => void;
}
const GroupViewTitlebar: React.FC<IGroupViewTitlebarProps> = ({ selectedId, onSelectGroup }) => {
  const groups = useGroupsStore();
  return (
    <div className={`titlebar student-group group`}>
      <div className="actions">
        { groups.allGroups
            .filter(group => group.users.length > 0)
            .map(group => {
              return <GroupButton id={group.id} key={group.id}
                                  selected={group.id === selectedId}
                                  onSelectGroup={onSelectGroup} />;
            })}
      </div>
    </div>
  );
};

interface IGroupTitlebarProps {
  selectedId: string;
  selectedGroupUser?: GroupUserModelType | undefined;
  context: string | undefined;
}

const GroupTitlebar: React.FC<IGroupTitlebarProps> = ({selectedId, selectedGroupUser, context}) => {
  return (
    <div className="group-title" data-test="group-title">
      <div className="group-title-center">
        <div className="group-name">
          {selectedId ? `Student Group ${selectedId}` : "No groups"}{selectedGroupUser && ":"}
        </div>
        {selectedGroupUser &&
          <div className={`fourup-selected-user ${context ? context : ""}`}>
            {selectedGroupUser.name}
          </div>
        }
      </div>
      {selectedGroupUser &&
        <button className="restore-fourup-button">
          <FourUpIcon />
          4-Up
        </button>
      }
    </div>
  );
};

interface IProps {
  groupId?: string;
  setGroupId: (groupId: string) => void;
}
export const StudentGroupView:React.FC<IProps> = ({ groupId, setGroupId }) => {
  const user = useUserStore();
  const groups = useGroupsStore();
  const [focusedGroupUser, setFocusedGroupUser] = useState<GroupUserModelType | undefined>();
  const [fourUpContext, setFourUpContext] = useState<string | undefined>(undefined);
  const selectedGroupId = groupId || (groups.allGroups.length ? groups.allGroups[0].id : "");
  const handleSelectGroup = (id: string) => {
    Logger.log(LogEventName.VIEW_GROUP, {group: id, via: "group-document-titlebar"});
    setGroupId(id);
    setFocusedGroupUser(undefined);
    setFourUpContext(undefined);
  };
  const handleSelectedStudent = (selectedGroupUser: GroupUserModelType | undefined) => {
    setFocusedGroupUser(selectedGroupUser);
  };
  const handleSelectedFourUpContext = (selectedContext: string | undefined) => {
    setFourUpContext(selectedContext);
  };
  return (
    <div key="student-group-view" className="document student-group-view">
      <GroupViewTitlebar selectedId={selectedGroupId} onSelectGroup={handleSelectGroup} />
      <GroupTitlebar selectedId={selectedGroupId} selectedGroupUser={focusedGroupUser} context={fourUpContext}/>
      <div className="canvas-area">
        <FourUpComponent userId={user.id} groupId={selectedGroupId} isGhostUser={true}
                          setFocusedGroupUser={handleSelectedStudent}
                          setSelectedFourUpContext={handleSelectedFourUpContext}
/>
      </div>
    </div>
  );
};
