import { useMemo } from "react";
import { IUserContext } from "../../functions/src/shared-types";
import { useAppMode, useClassStore, useDemoStore, useUserStore } from "./use-stores";

export const useUserContext = (): IUserContext => {
  const appMode = useAppMode();
  const { name: demoName } = useDemoStore();
  const classInfo = useClassStore();
  const { id: uid, portal, type, name, teacherNetwork: network, classHash } = useUserStore();
  return useMemo(() => {
    const teachers: string[] = [];
    classInfo.users.forEach(user => (user.type === "teacher") && teachers.push(user.id));
    return {
      appMode, demoName, portal, uid, type, name, network, classHash, teachers
    };
    // user context never changes during a session
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
};
