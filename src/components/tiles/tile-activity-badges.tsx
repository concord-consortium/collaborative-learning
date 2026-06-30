import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";
import { Tooltip } from "react-tippy";
import { useStores } from "../../hooks/use-stores";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { DrivingQuestionBoardDocument, GroupDocument } from "../../models/document/document-types";

import UserIcon from "../../assets/icons/clue-dashboard/teacher-student.svg";

import "./tile-activity-badges.scss";

const MAX_VISIBLE = 4;

interface UserInfo {
  initials: string;
  name: string;
  userId: string;
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
  const testId = overflow ? "activity-badge-overflow" : "activity-badge";
  const tooltipHtml = (
    <div className="badge-tooltip">
      {users.map(u => (<div key={u.userId}>{u.name}</div>))}
    </div>
  );

  return (
    <Tooltip html={tooltipHtml} {...tooltipOptions}>
      <div className={classNames("badge", { overflow })} data-testid={testId}>
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
  const { groupActivity, dqbActivity, groups, class: classStore, documents, user } = useStores();

  // Render for group documents (group-scoped presence) and the class-wide Driving
  // Question Board (class-scoped presence).
  const document = documents.getDocument(documentKey);
  const isGroupDoc = document?.type === GroupDocument;
  const isDQB = document?.type === DrivingQuestionBoardDocument;
  if (!isGroupDoc && !isDQB) return null;

  const activity = isDQB ? dqbActivity : groupActivity;
  const focused = activity.usersFocusedOnTile(documentKey, tileId, user.id);
  if (focused.length === 0) return null;

  // Resolve names/initials. Group docs resolve through the local user's group; the DQB
  // resolves through the whole class, since its presence spans every class member.
  const group = groups.groupForUser(user.id);
  const groupUsers = group?.users ?? [];
  const usersWithIdentity: UserInfo[] = focused
    .map(a => {
      if (isDQB) {
        const u = classStore.getUserById(a.userId);
        return u ? { userId: a.userId, initials: u.initials, name: u.fullName } : null;
      }
      const gu = groupUsers.find(member => member.id === a.userId);
      return gu ? { userId: a.userId, initials: gu.initials, name: gu.name } : null;
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);
  if (usersWithIdentity.length === 0) return null;

  const visibleUsers = usersWithIdentity.slice(0, MAX_VISIBLE);
  const overflowUsers = usersWithIdentity.slice(MAX_VISIBLE);

  const className = classNames("tile-activity-badges", { "drag-handle-visible": hovered || selected });

  return (
    <div className={className} data-testid="tile-activity-badges">
      {visibleUsers.map(u => <TileActivityBadge key={u.userId} users={[u]} />)}
      <TileActivityBadge forceOverflow={true} users={overflowUsers} />
    </div>
  );
});
