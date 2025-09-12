import React from "react";
import classNames from "classnames";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import ChatAvatar from "../chat/chat-avatar";
import { getDisplayTimeDate } from "../../utilities/time";

import "./comment-marker.scss";

interface IProps {
  comment: WithId<CommentDocument>;
  commentLocation?: number;
  activeNavTab?: string;
  onClick: (commentEntry: WithId<CommentDocument>) => void;
}

export const CommentMarker: React.FC<IProps> = ({comment, commentLocation, activeNavTab, onClick}) => {
  // 10px is half the width of the marker, it is subtracted to center it
  const style = {left: `calc(${commentLocation}% - 10px)`};

  const handleOnClick = () => onClick(comment);
  const title = `${comment.name}\n${getDisplayTimeDate(comment.createdAt.getTime())}`;

  return (
    <div key={`comment-${comment.id}`} className="comment-marker" style={style} onClick={handleOnClick} title={title}>
      <div className={classNames("vertical-line", activeNavTab)} />
      <ChatAvatar uid={comment.uid} />
    </div>
  );
};
