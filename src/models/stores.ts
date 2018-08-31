import { ProblemModel, ProblemModelType } from "./problem";
import { UIModel, UIModelType } from "./ui";
import { UserModel, UserModelType } from "./user";
import { DB } from "../lib/db";

export type AppMode = "authed" | "dev" | "test";

export interface IStores {
  appMode: AppMode;
  problem: ProblemModelType;
  user: UserModelType;
  ui: UIModelType;
  db: DB;
}

export interface ICreateStores {
  appMode?: AppMode;
  problem?: ProblemModelType;
  user?: UserModelType;
  ui?: UIModelType;
  db?: DB;
}

export function createStores(params?: ICreateStores): IStores {
  return {
    appMode: params && params.appMode ? params.appMode : "dev",
    // for ease of testing, we create a null problem if none is provided
    problem: params && params.problem || ProblemModel.create({ ordinal: 0, title: "Null Problem" }),
    user: params && params.user || UserModel.create(),
    ui: params && params.ui || UIModel.create(),
    db: params && params.db || new DB(),
  };
}
