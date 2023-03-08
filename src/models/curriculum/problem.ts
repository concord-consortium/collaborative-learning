import { getSnapshot, Instance, SnapshotIn, types } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { SectionModel, SectionModelType } from "./section";
import { SettingsMstType } from "../stores/settings";
import { SupportModel } from "./support";
import { ProblemConfiguration } from "../stores/problem-configuration";
import { ITileEnvironment } from "../tiles/tile-content";
import { SharedModelDocumentManager } from "../document/shared-model-document-manager";

const LegacyProblemModel = types
  .model("Problem", {
    ordinal: types.integer,
    title: types.string,
    subtitle: "",
    disabled: types.array(types.string),
    sections: types.array(SectionModel),
    supports: types.array(SupportModel),
    settings: types.maybe(SettingsMstType)
  });

const ModernProblemModel = types
  .model("Problem", {
    ordinal: types.integer,
    title: types.string,
    subtitle: "",
    // loadedSections are part of the tree, but clients should use the sections view instead
    loadedSections: types.array(SectionModel),
    supports: types.array(SupportModel),
    config: types.maybe(types.frozen<Partial<ProblemConfiguration>>())
  })
  .views(self => ({
    get fullTitle() {
      return `${self.title}${self.subtitle ? `: ${self.subtitle}` : ""}`;
    },

    // In order to support shared models in the sections. Each section has to
    // have its own MST environment to hold its document's sharedModelManager.
    // So each section has to be its own tree and cannot be a child of the
    // problem.
    get sections() {
      return self.loadedSections.map(section => {
        const sharedModelManager = new SharedModelDocumentManager();
        const environment: ITileEnvironment = {
          sharedModelManager
        };
        const sectionSnapshot = getSnapshot(section);
        // We have to make a copy of the sectionSnapshot because child models modify
        // their snapshots in place during preProcessor calls. The objects from
        // getSnapshot are readonly
        const sectionCopy = SectionModel.create(cloneDeep(sectionSnapshot), environment);
        sectionCopy.setRealParent(self);
        if (sectionCopy.content) {
          sharedModelManager.setDocument(sectionCopy.content);
        }
        return sectionCopy;
      });
    }
  }))
  .views(self => ({
    getSectionByIndex(index: number): SectionModelType|undefined {
      const safeIndex = Math.max(0, Math.min(index, self.sections.length - 1));
      return self.sections[safeIndex];
    },
    getSectionById(sectionId: string): SectionModelType|undefined {
      return self.sections.find((section) => section.type === sectionId);
    }
  }));
interface LegacySnapshot extends SnapshotIn<typeof LegacyProblemModel> {}
interface ModernSnapshot extends SnapshotIn<typeof ModernProblemModel> {}

export const ProblemModel = types.snapshotProcessor(ModernProblemModel, {
  preProcessor(sn: ModernSnapshot & LegacySnapshot) {
    const { disabled: _disabled, settings: _settings, config: _config, sections, ...others } = sn;
    const disabledFeatures = _disabled ? { disabledFeatures: _disabled } : undefined;
    const settings = _settings ? { settings: _settings } : undefined;
    const config = _config || disabledFeatures || settings
                    ? { config: { ...disabledFeatures, ...settings, ..._config } }
                    : undefined;
    const loadedSections = sections ? { loadedSections: sections } : undefined;
    return { ...others, ...config, ...loadedSections };
  }
});
export interface ProblemModelType extends Instance<typeof ModernProblemModel> {}
