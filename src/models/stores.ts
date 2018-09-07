import { ProblemModel, ProblemModelType } from "./curriculum/problem";
import { UIModel, UIModelType } from "./ui";
import { UserModel, UserModelType } from "./user";
import { GroupsModel, GroupsModelType } from "./groups";
import { DB } from "../lib/db";

export type AppMode = "authed" | "dev" | "test";

export interface IStores {
  appMode: AppMode;
  problem: ProblemModelType;
  user: UserModelType;
  ui: UIModelType;
  groups: GroupsModelType;
  db: DB;
}

export interface ICreateStores {
  appMode?: AppMode;
  problem?: ProblemModelType;
  user?: UserModelType;
  ui?: UIModelType;
  groups?: GroupsModelType;
  db?: DB;
}

export function createStores(params?: ICreateStores): IStores {
  return {
    appMode: params && params.appMode ? params.appMode : "dev",
    // for ease of testing, we create a null problem if none is provided
    problem: params && params.problem || ProblemModel.create({ ordinal: 0, title: "Null Problem" }),
    user: params && params.user || UserModel.create({id: "0"}),
    ui: params && params.ui || UIModel.create(),
    groups: params && params.groups || GroupsModel.create(),
    db: params && params.db || new DB(),
  };
}
