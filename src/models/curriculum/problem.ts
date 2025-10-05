import { observable } from "mobx";
import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { SectionModel, SectionModelSnapshot, SectionModelType } from "./section";
import { SettingsMstType } from "../stores/settings";
import { SupportModel } from "./support";
import { ProblemConfiguration } from "../stores/problem-configuration";
import { ITileEnvironment } from "../tiles/tile-content";
import { SharedModelDocumentManager } from "../document/shared-model-document-manager";
import { getContent } from "../../utilities/get-content";

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
     * sectionsFromSnapshot are populated from the "sections" property of the serialized problem
     * clients should use the `sections` volatile property instead.
     * A frozen type is used here so MST doesn't validate the id references of the section
     * with all of the other sections in this problem, or this problem's unit
     */
    sectionsFromSnapshot: types.frozen<SectionModelSnapshot[]>(),
    exemplars: types.array(types.string),
    config: types.maybe(types.frozen<Partial<ProblemConfiguration>>())
  })
  .volatile(self => ({
    sections: observable.array() as SectionModelType[]
  }))
  .views(self => ({
    get fullTitle() {
      return `${self.title}${self.subtitle ? `: ${self.subtitle}` : ""}`;
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
  }))
  .actions(self => ({
    // In order to support shared models in the sections. Each section has to
    // have its own MST environment to hold its document's sharedModelManager.
    // So each section has to be its own tree and cannot be a child of the
    // problem.
    addSections(sectionsSnap: SectionModelSnapshot[]){
      for (const sectionSnap of sectionsSnap) {
        const sharedModelManager = new SharedModelDocumentManager();
        const environment: ITileEnvironment = {
          sharedModelManager
        };
        const section = SectionModel.create(sectionSnap, environment);
        section.setRealParent(self);
        if (section.content) {
          sharedModelManager.setDocument(section.content);
        }
        self.sections.push(section);
      }
    }
  }))
  .actions(self => ({
    async loadSections(unitUrl: string){
      const sectionPromises = self.sectionsFromSnapshot.map(section => {
        // Currently, curriculum files can either contain their problem section data inline
        // or in external JSON files. In the latter case, the problem sections arrays will
        // be made up of strings that are paths to the external files. Eventually, all
        // curriculum files will be updated so their problem section data is in external
        // files.
        if (typeof section === "string") {
          const sectionDataFile = section;
          const sectionDataUrl = new URL(sectionDataFile, unitUrl).href;
          return getExternalProblemSectionData(sectionDataUrl);
        } else {
          // handle any remaining units with inline sections
          return Promise.resolve(section);
        }
      });

      // Wait for all of the external sections to be downloaded
      const sections = await Promise.all(sectionPromises);
      self.addSections(sections);
    }
  }));

  function getExternalProblemSectionData(dataUrl: string){
    try {
      return getContent(dataUrl).then(res => res.json());
    } catch (error) {
      throw new Error(`Failed to load problem-section ${dataUrl} cause:\n ${error}`);
    }
  }

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
    // Move sections to sectionsFromSnapshot so we load them into a volatile property `sections`
    const sectionsFromSnapshot = sections || [];
    if (isLegacySnapshot(sn)) {
      const { disabled: disabledFeatures, settings, ...others } = sn;
      return { ...others,
        sectionsFromSnapshot,
        config: { disabledFeatures, settings }
      } as ModernProblemSnapshot;
    }
    if (isAmbiguousSnapshot(sn)) {
      const { disabled: disabledFeatures, settings, config, ...others } = sn as any;
      return {
        ...others,
        sectionsFromSnapshot,
        config: { disabledFeatures, settings, ...config }
      } as ModernProblemSnapshot;
    }
    return { ...nonSectionProps, sectionsFromSnapshot };
  }
});
export interface ProblemModelType extends Instance<typeof ModernProblemModel> {}
