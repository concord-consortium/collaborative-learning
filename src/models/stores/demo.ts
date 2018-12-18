import { types } from "mobx-state-tree";

export const DemoClassModel = types
  .model("DemoClass", {
    id: types.string,
    name: types.string,
  });

export const DemoModel = types
  .model("Demo", {
    class: DemoClassModel,
    problemOrdinal: types.maybeNull(types.string),
    problemIndex: 0
  })
  .actions((self) => {
    return {
      setProblemOrdinal(problemOrdinal: string) {
        self.problemOrdinal = problemOrdinal;
      },
      setProblemIndex(problemIndex: number) {
        self.problemIndex = problemIndex;
      },
      setClass(id: string, name: string) {
        self.class.id = id;
        self.class.name = name;
      }
    };
  });

export type DemoClassModelType = typeof DemoClassModel.Type;
export type DemoModelType = typeof DemoModel.Type;
