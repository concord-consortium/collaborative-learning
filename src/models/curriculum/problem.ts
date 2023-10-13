import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { SectionModel, SectionModelSnapshot, SectionModelType } from "./section";
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
    /**
     * loadedSections are populated from the "sections" property of the serialized problem
     * clients should use the `sections` view instead.
     * A frozen type is used here so MST doesn't validate the id references of the section
     * with all of the other sections in this problem, or this problem's unit
     */
    loadedSections: types.frozen<SectionModelSnapshot[]>(),
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
        const sectionCopy = SectionModel.create(section, environment);
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
export interface LegacyProblemSnapshot extends SnapshotIn<typeof LegacyProblemModel> {}
export interface ModernProblemSnapshot extends SnapshotIn<typeof ModernProblemModel> {}

const hasLegacySnapshotProperties = (sn: ModernProblemSnapshot | LegacyProblemSnapshot) => {
  return "disabled" in sn || "sections" in sn || "settings" in sn;
};
const isLegacySnapshot = (sn: ModernProblemSnapshot | LegacyProblemSnapshot): sn is LegacyProblemSnapshot => {
  return !("config" in sn) && hasLegacySnapshotProperties(sn);
};
const isAmbiguousSnapshot = (sn: ModernProblemSnapshot | LegacyProblemSnapshot) => {
  return "config" in sn && hasLegacySnapshotProperties(sn);
};

export const ProblemModel = types.snapshotProcessor(ModernProblemModel, {
  preProcessor(sn: ModernProblemSnapshot | LegacyProblemSnapshot) {
    const { sections, ...nonSectionProps } = sn as any;
    // Move sections to loadedSections so we can have a view called `sections`
    const loadedSections = sections || [];
    if (isLegacySnapshot(sn)) {
      const { disabled: disabledFeatures, settings, ...others } = sn;
      return { ...others, loadedSections, config: { disabledFeatures, settings } } as ModernProblemSnapshot;
    }
    if (isAmbiguousSnapshot(sn)) {
      const { disabled: disabledFeatures, settings, config, ...others } = sn as any;
      return { ...others, loadedSections, config: { disabledFeatures, settings, ...config } } as ModernProblemSnapshot;
    }
    return { ...nonSectionProps, loadedSections };
  }
});
export interface ProblemModelType extends Instance<typeof ModernProblemModel> {}
