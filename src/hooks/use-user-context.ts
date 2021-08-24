import { IUserContext } from "../../functions/src/shared-types";
import { useAppMode, useClassStore, useDemoStore, useUserStore } from "./use-stores";

export const useUserContext = (): IUserContext => {
  const appMode = useAppMode();
  const { name: demoName } = useDemoStore();
  const classInfo = useClassStore();
  const teachers: string[] = [];
  classInfo.users.forEach(user => (user.type === "teacher") && teachers.push(user.id));
  const { id: uid, portal, type, name, teacherNetwork: network, classHash } = useUserStore();
  return {
    appMode, demoName, portal, uid, type, name, network, classHash, teachers
  };
};
