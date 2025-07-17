import React from "react";
import classNames from "classnames";
import { useStores } from "../../hooks/use-stores";
import { kAnalyzerUserParams, kExemplarUserParams } from "../../../shared/shared";

import StudentAvatar from "../../assets/student-avatar.svg";
import TeacherAvatar from "../../assets/teacher-avatar.svg";
import AdaAvatar from "../../assets/ada-avatar.svg";

interface IChatAvatarProps {
  uid: string;
  isMe?: boolean;
  pulse?: boolean;
}

/**
 * ChatAvatar displays a user avatar image in the chat UI.
 */
const ChatAvatar: React.FC<IChatAvatarProps> = ({ uid, isMe, pulse }) => {
  const { class: classStore } = useStores();
  const user = classStore.getUserById(uid);
  const isAda = uid === kAnalyzerUserParams.id;
  const isIvan = uid === kExemplarUserParams.id;
  const isTeacherOrResearcher = isAda || user?.type === "teacher" || user?.type === "researcher";
  const Image = isAda ? AdaAvatar
    : isTeacherOrResearcher ? TeacherAvatar : StudentAvatar;
  const round = !isTeacherOrResearcher;

  const classes = classNames("user-icon", {
    pulse,
    round,
    me: isMe && !isTeacherOrResearcher,
    teacher: isTeacherOrResearcher,
    ada: isAda,
    ivan: isIvan
  });

  return (
    <span className={classes} data-testid="chat-thread-user-icon">
      <Image />
    </span>
  );
};

export default ChatAvatar;
