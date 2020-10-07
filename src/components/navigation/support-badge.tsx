import React from "react";
import { observer } from "mobx-react";
import { UserModelType } from "../../models/stores/user";
import { SupportsModelType } from "../../models/stores/supports";

interface IProps {
  user: UserModelType;
  supports: SupportsModelType;
}

export const SupportBadge = observer(({user, supports}: IProps) => {
  return (
    (user.isStudent && supports.hasNewTeacherSupports(user.lastSupportViewTimestamp))
      ? <div className="support-badge"/>
      : null
  );
});
