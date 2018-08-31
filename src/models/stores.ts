import { ProblemModel, ProblemModelType } from "./problem";
import { UIModel, UIModelType } from "./ui";
import { UserModel, UserModelType } from "./user";

export interface IStores {
  devMode: boolean;
  problem: ProblemModelType;
  user: UserModelType;
  ui: UIModelType;
}

export interface ICreateStores {
  devMode?: boolean;
  problem?: ProblemModelType;
  user?: UserModelType;
  ui?: UIModelType;
}

export function createStores(params?: ICreateStores): IStores {
  return {
    devMode: params && (params.devMode != null) ? params.devMode : false,
    // for ease of testing, we create a null problem if none is provided
    problem: params && params.problem || ProblemModel.create({ ordinal: 0, title: "Null Problem" }),
    user: params && params.user || UserModel.create(),
    ui: params && params.ui || UIModel.create()
  };
}
