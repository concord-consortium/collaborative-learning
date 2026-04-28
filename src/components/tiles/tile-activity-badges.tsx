import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";
import { Tooltip } from "react-tippy";
import { useStores } from "../../hooks/use-stores";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { GroupDocument } from "../../models/document/document-types";

import "./tile-activity-badges.scss";

interface UserInfo {
  userId: string;
  initials: string;
  name: string;
}

const MAX_VISIBLE = 4;

interface ITileActivityBadge {
  users: UserInfo[];
}

function TileActivityBadge({ users }: ITileActivityBadge) {
  const tooltipOptions = useTooltipOptions({ distance: 6 });

  if (users.length <= 0) return null;

  const text = users.length === 1 ? users[0].initials : `+${users.length}`;
  const tooltipText = users.map(u => u.name).join(", ");
  const classes = classNames("badge", { overflow: users.length > 1 });

  return (
    <Tooltip title={tooltipText} {...tooltipOptions}>
      <div className={classes} data-testid="activity-badge">
        {text}
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

  // Don't render a badge for the local user's own focus — they already see
  // their selection highlighted in the UI; badges show what *other* group
  // members are doing.
  const focused = groupActivity
    .usersFocusedOnTile(documentKey, tileId)
    .filter(activity => activity.userId !== user.id);
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

  const visible = usersWithIdentity.slice(0, MAX_VISIBLE);
  const overflow = usersWithIdentity.slice(MAX_VISIBLE);

  const className = classNames("tile-activity-badges", {
    "drag-handle-visible": hovered || selected
  });

  return (
    <div className={className} data-testid="tile-activity-badges">
      {visible.map(u => <TileActivityBadge key={u.userId} users={[u]} />)}
      {overflow.length > 0 && <TileActivityBadge users={overflow} />}
    </div>
  );
});
