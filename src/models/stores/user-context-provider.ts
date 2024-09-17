import { computed, makeObservable } from "mobx";
import { IBaseStores } from "./base-stores-types";

export class UserContextProvider {
  stores: IBaseStores;

  constructor(stores: IBaseStores) {
    makeObservable(this, {
      userContext: computed
    });
    this.stores = stores;
  }

  /**
   * This user context is sent to the Firebase functions so they know the context of the
   * request.
   */
  get userContext() {
    const appMode = this.stores.appMode;
    const { name: demoName } = this.stores.demo;
    const classInfo = this.stores.class;
    const { id: uid, portal, type, name, network, classHash } = this.stores.user;
    const teachers: string[] = [];
    classInfo.users.forEach(user => (user.type === "teacher") && teachers.push(user.id));
    return {
      appMode, demoName, portal, uid, type, name, network, classHash, teachers
    };
  }
}
