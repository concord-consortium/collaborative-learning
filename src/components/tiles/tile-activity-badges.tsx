import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";
import { Tooltip } from "react-tippy";
import { useStores } from "../../hooks/use-stores";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { GroupDocument } from "../../models/document/document-types";

import UserIcon from "../../assets/icons/clue-dashboard/teacher-student.svg";

import "./tile-activity-badges.scss";

const MAX_VISIBLE = 4;

interface UserInfo {
  userId: string;
  initials: string;
  name: string;
}

interface ITileActivityBadge {
  forceOverflow?: boolean;
  users: UserInfo[];
}

function TileActivityBadge({ forceOverflow, users }: ITileActivityBadge) {
  const tooltipOptions = useTooltipOptions({ distance: 6 });

  if (users.length <= 0) return null;

  const overflow = forceOverflow || users.length > 1;
  const text = overflow ? `+${users.length}` : users[0].initials;
  const tooltipText = users.map(u => u.name).join(", ");
  const classes = classNames("badge", { overflow });

  return (
    <Tooltip title={tooltipText} {...tooltipOptions}>
      <div className={classes} data-testid="activity-badge">
        <UserIcon className="user-icon" />
        <span>{text}</span>
      </div>
    </Tooltip>
  );
}

interface IProps {
  documentKey: string;
  tileId: string;
  hovered: boolean;
  selected: boolean;
}

export const TileActivityBadges = observer(function TileActivityBadges({
  documentKey, tileId, hovered, selected
}: IProps) {
  const { groupActivity, groups, documents, user } = useStores();

  const document = documents.getDocument(documentKey);
  if (document?.type !== GroupDocument) return null;

  const focused = groupActivity.usersFocusedOnTile(documentKey, tileId, user.id);
  if (focused.length === 0) return null;

  // The activity listener is scoped to a single group, so every focused user
  // shares the local user's group; resolve names/initials through that group.
  const group = groups.groupForUser(user.id);
  const groupUsers = group?.users ?? [];
  const usersWithIdentity: UserInfo[] = focused
    .map(activity => {
      const u = groupUsers.find(gu => gu.id === activity.userId);
      if (!u) return null;
      return { userId: activity.userId, initials: u.initials, name: u.name };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);
  if (usersWithIdentity.length === 0) return null;

  const visibleUsers = usersWithIdentity.slice(0, MAX_VISIBLE);
  const overflowUsers = usersWithIdentity.slice(MAX_VISIBLE);

  const className = classNames("tile-activity-badges", {
    "drag-handle-visible": hovered || selected
  });

  return (
    <div className={className} data-testid="tile-activity-badges">
      {visibleUsers.map(u => <TileActivityBadge key={u.userId} users={[u]} />)}
      <TileActivityBadge forceOverflow={true} users={overflowUsers} />
    </div>
  );
});
