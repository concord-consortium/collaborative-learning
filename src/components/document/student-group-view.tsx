import React from "react";
import { useGroupsStore, useUserStore } from "../../hooks/use-stores";
import { LogEventName, Logger } from "../../lib/logger";
import { FourUpComponent } from "../four-up";
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
      {<div className="group-title" data-test="document-title">
          {selectedId ? `Group ${selectedId}` : "No groups"}
       </div>}
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
  const selectedGroupId = groupId || (groups.allGroups.length ? groups.allGroups[0].id : "");
  const handleSelectGroup = (id: string) => {
    Logger.log(LogEventName.VIEW_GROUP, {group: id, via: "group-document-titlebar"});
    setGroupId(id);
  };
  return (
    <div key="student-group-view" className="document student-group-view">
      <GroupViewTitlebar selectedId={selectedGroupId} onSelectGroup={handleSelectGroup} />
      <div className="canvas-area">
        <FourUpComponent userId={user.id} groupId={selectedGroupId} isGhostUser={true} />
      </div>
    </div>
  );
};
