import React from "react";
import { observer } from "mobx-react";

interface IProps {
  user: any
  supports: any
}

export const SupportBadge = observer(({user, supports}: IProps) => {
  if (user.isStudent && supports.hasNewTeacherSupports(user.lastSupportViewTimestamp)) {
    return ( <div className={`support-badge`} /> );
  } else {
    return null;
  }
});
