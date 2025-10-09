import { useEffect, useState } from "react";
import firebase from "firebase/app";

import { useCurriculum } from "./use-curriculum";
import { IProblem, IUnit, IUnitFiles } from "../types";
import { useAuthoringApi } from "./use-authoring-api";

const fileDescriptions: Record<string, string | undefined> = {
  "content.json": "Unit configuration",
  "teacher-guide/content.json": "Teacher Guide configuration"
};

export interface ICommitDescription {
  path: string;
  description: string;
  date: string;
}

export interface IUseCommitDescriptionOptions {
  branch?: string;
  unit?: string;
}

interface ICommitInfo {
  unitConfig?: IUnit;
  teacherGuideConfig?: IUnit;
  files?: IUnitFiles;
}

export interface ICommitDescriptionResult {
  descriptions: ICommitDescription[];
  descriptionsState: "loading" | "ready";
}

export const useCommitDescriptions = ({branch, unit}: IUseCommitDescriptionOptions): ICommitDescriptionResult => {
  const curriculum = useCurriculum();
  const api = useAuthoringApi();
  const { branchMetadata } = curriculum;
  const [descriptions, setDescriptions] = useState<ICommitDescription[]>([]);
  const [commitInfo, setCommitInfo] = useState<ICommitInfo>({});
  const [descriptionsState, setDescriptionsState] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    // when used in the commit UI, branch and unit should always match the curriculum context
    // but when used in the admin UI for other branches/units, they will not
    if (branch === curriculum.branch && unit === curriculum.unit) {
      setCommitInfo({
        unitConfig: curriculum.unitConfig,
        teacherGuideConfig: curriculum.teacherGuideConfig,
        files: curriculum.files
      });
    } else if (branch && unit) {
      const fetchCommitInfo = async () => {
        const getContent = (path: string): Promise<IUnit|undefined> => {
          return api
            .get("/getContent", { branch, unit, path })
            .then(response => {
              if (response.success) {
                return response.content;
              }
            })
            .catch(() => {
              return undefined;
            });
        };

        // fetch all the data
        const unitPromise = getContent("content.json");
        const teacherGuidePromise = getContent("teacher-guide/content.json");
        const filesPromise = new Promise<IUnitFiles>((resolve) => {
          firebase
            .database()
            .ref(`authoring/content/branches/${branch}/units/${unit}/files`)
            .once("value")
            .then(snapshot => {
              const values = snapshot.val() ?? {};
              // Firebase does not allow certain characters in keys, so they are escaped when stored.
              const escapedValues = Object.keys(values).reduce<IUnitFiles>((acc, key) => {
                const escapedKey = decodeURIComponent(key);
                acc[escapedKey] = values[key];
                return acc;
              }, {});
              resolve(escapedValues);
            })
            .catch(() => resolve({}));
        });
        const result = await Promise.all([unitPromise, teacherGuidePromise, filesPromise]);

        return {unitConfig: result[0], teacherGuideConfig: result[1], files: result[2]};
      };

      fetchCommitInfo().then(info => setCommitInfo(info));
    }
  }, [branch, curriculum, unit, api]);

  useEffect(() => {
    const { unitConfig, teacherGuideConfig, files } = commitInfo;

    if (!branch || !unit || !unitConfig || !files) {
      setDescriptions([]);
      setDescriptionsState("loading");
      return;
    }

    const unitUpdates = branchMetadata[branch]?.units[unit]?.updates ?? {};
    if (Object.keys(unitUpdates).length === 0) {
      setDescriptions([]);
      setDescriptionsState("ready");
      return;
    }

    const sectionMapping: Record<string, string | undefined> = {};

    const mapProblems = (config: IUnit, problems: IProblem[], parentTitle: string) => {
      problems.forEach(prob => {
        prob.sections.forEach(rawSectionPath => {
          const type = config === teacherGuideConfig ? "Teacher Guides" : "Investigations";
          const sectionPath = `${config === teacherGuideConfig ? "teacher-guide/" : ""}${rawSectionPath}`;
          const file = files?.[sectionPath];
          const section = file && file.type ? config.sections?.[file.type] : undefined;
          if (section) {
            sectionMapping[sectionPath] = `${type} ❯ ${parentTitle} ❯ ${prob.title} ❯ ${section.title}`;
          }
        });
      });
    };

    unitConfig.investigations.forEach(inv => {
      mapProblems(unitConfig, inv.problems, inv.title);
    });
    teacherGuideConfig?.investigations.forEach(inv => {
      mapProblems(teacherGuideConfig, inv.problems, inv.title);
    });

    const result = Object.entries(unitUpdates).map(([encodedPath, timestamp]) => {
      const date = new Date(timestamp);
      const path = decodeURIComponent(encodedPath);
      const description = fileDescriptions[path] ?? sectionMapping[path] ?? path;
      return { path, description, date: date.toLocaleString() };
    });

    setDescriptions(result);
    setDescriptionsState("ready");
  }, [branch, unit, branchMetadata, commitInfo]);

  return { descriptionsState, descriptions };
};
