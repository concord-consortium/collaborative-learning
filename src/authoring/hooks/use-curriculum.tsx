import React, { createContext, useContext, useMemo } from "react";
import { useImmer, Updater } from "use-immer";
import firebase from "firebase/app";

import { IUnit, IUnitFiles } from "../types";
import { AuthoringApi, useAuthoringApi } from "./use-authoring-api";
import { Auth, useAuth } from "./use-auth";
import { AuthoringPreview, useAuthoringPreview } from "./use-authoring-preview";

export type SaveState = "saving" | "saved" | "error" | undefined;

export type UnitMetadata = {
  pulledAt: number;
  updates?: Record<string, number>;
}

export type PerBranchMetadata = {
  units: Record<string, UnitMetadata>;
}

export type BranchMetadata = Record<string, PerBranchMetadata>;

export type ExemplarFile = {
  path: string;
  title: string;
};

export type CurriculumContextValue = {
  branch: string | undefined;
  setBranch: (newBranch?: string, updateHash?: boolean) => void;
  unit: string | undefined;
  setUnit: (newUnit?: string, updateHash?: boolean) => void;
  unitConfig: IUnit | undefined;
  setUnitConfig: Updater<IUnit | undefined>;
  teacherGuideConfig: IUnit | undefined;
  setTeacherGuideConfig: Updater<IUnit | undefined>;
  error: string | undefined;
  setError: (err?: string) => void;
  path: string | undefined;
  files: IUnitFiles | undefined;
  reset: () => void;
  saveContent: (contentPath: string, updatedContent: any) => Promise<void>;
  saveState: SaveState;
  branchMetadata: BranchMetadata;
  exemplarFiles: ExemplarFile[];
};

export const defaultPath = "config/curriculumTabs";

const CurriculumContext = createContext<CurriculumContextValue | null>(null);

export const CurriculumProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const auth: Auth = useAuth();
  const api: AuthoringApi = useAuthoringApi();
  const authoringPreview: AuthoringPreview = useAuthoringPreview();

  const { useCallback, useEffect, useRef } = React;

  const [branch, _setBranch] = useImmer<string | undefined>(undefined);
  const [unit, _setUnit] = useImmer<string | undefined>(undefined);
  const [path, setPath] = useImmer<string | undefined>(undefined);
  const [unitConfig, _setUnitConfig] = useImmer<IUnit | undefined>(undefined);
  const [teacherGuideConfig, setTeacherGuideConfig] = useImmer<IUnit | undefined>(undefined);
  const [files, setFiles] = useImmer<IUnitFiles | undefined>(undefined);
  const [error, setError] = useImmer<string | undefined>(undefined);
  const lastUnitRef = useRef<string | undefined>(undefined);
  const filesRef = useRef<firebase.database.Reference | undefined>(undefined);
  const [saveState, setSaveState] = useImmer<SaveState | undefined>(undefined);
  const [branchMetadata, setBranchMetadata] = useImmer<BranchMetadata>({});
  const [exemplarFiles, setExemplarFiles] = useImmer<ExemplarFile[]>([]);
  const saveUnitConfigRef = useRef(false);
  const saveStateClearTimeoutRef = useRef<number>();

  const reset = useCallback(() => {
    setError(undefined);
    _setBranch(undefined);
    _setUnit(undefined);
    _setUnitConfig(undefined);
    lastUnitRef.current = undefined;
  }, [_setBranch, _setUnit, setError, _setUnitConfig]);

  // externally when setUnitConfig is called, we want to update the state
  // and also call the api to save the changes
  const setUnitConfig: Updater<IUnit | undefined> = (draft) => {
    saveUnitConfigRef.current = true;
    _setUnitConfig(draft);
  };

  const setUnit = useCallback(
    (newUnit?: string, updateHash?: boolean) => {
      if (newUnit && branch && !branchMetadata[branch]?.units[newUnit]) {
        setError(`The ${newUnit} unit on the ${branch} branch is not available for authoring.`);
        return;
      }
      _setUnit(newUnit);
      if (updateHash) {
        window.location.hash =
          branch && newUnit
            ? `#/${branch}/${newUnit}/${defaultPath}`
            : branch
            ? `#/${branch}`
            : "#";
      }
    },
    [_setUnit, setError, branch, branchMetadata]
  );

  const setBranch = useCallback(
    (newBranch?: string, updateHash?: boolean) => {
      if (newBranch && !branchMetadata[newBranch]) {
        setError(`The ${newBranch} branch is not available for authoring.`);
        return;
      }

      // reset unit and unitConfig when branch changes
      if (newBranch !== branch) {
        reset();
      }
      _setBranch(newBranch);
      if (updateHash) {
        window.location.hash = newBranch ? `#/${newBranch}` : "#";
      }
    },
    [_setBranch, branch, reset, setError, branchMetadata]
  );

  const processHash = useCallback(() => {
    const [_, _branch, _unit, ...rest] = window.location.hash.split("/");

    setBranch(_branch);
    setUnit(_unit);
    setPath(rest.length > 0 ? rest.join("/") : undefined);
  }, [setBranch, setUnit, setPath]);

  useEffect(() => {
    window.addEventListener("hashchange", processHash);
    return () => window.removeEventListener("hashchange", processHash);
  }, [processHash]);

  const hasBranchMetadata = useMemo(() => Object.keys(branchMetadata).length > 0, [branchMetadata]);

  useEffect(() => {
    // wait until auth is ready
    if (auth.firebaseToken && auth.gitHubToken && hasBranchMetadata) {
      processHash();
    } else {
      reset();
    }
  }, [auth.firebaseToken, auth.gitHubToken, processHash, reset, hasBranchMetadata]);

  useEffect(() => {
    // wait until authenticated to Firebase
    if (auth.firebaseToken) {
      const onBranchMetadataChange = (snapshot: firebase.database.DataSnapshot) => {
        const values = snapshot.val() ?? {};
        setBranchMetadata(values);
      };

      const branchMetadataRef = firebase
        .database()
        .ref("authoring/metadata/branches");
      branchMetadataRef.on("value", onBranchMetadataChange);
      return () => branchMetadataRef.off();
    }
  }, [auth.firebaseToken, setBranchMetadata]);

  useEffect(() => {
    const onFilesChange = (snapshot: firebase.database.DataSnapshot) => {
      const values = snapshot.val() ?? {};
      // Firebase does not allow certain characters in keys, so they are escaped when stored.
      const escapedValues = Object.keys(values).reduce<IUnitFiles>((acc, key) => {
        const escapedKey = decodeURIComponent(key);
        acc[escapedKey] = values[key];
        return acc;
      }, {});
      setFiles(escapedValues);
    };

    // prevent unnecessary fetches
    if (branch && unit && (!lastUnitRef.current || lastUnitRef.current !== unit)) {
      lastUnitRef.current = unit;

      // Setup a Firebase listener for the unit file metadata changes so that we get real-time updates.
      // We only do direct reads - writes to unit file metadata changes go through the API.
      filesRef.current?.off();
      filesRef.current = firebase
        .database()
        .ref(`authoring/content/branches/${branch}/units/${unit}/files`);
      filesRef.current.on("value", onFilesChange);

      // fetch content
      api
        .get("/getContent", { branch, unit, path: "content.json" })
        .then((contentResponse) => {
          if (!contentResponse.success) {
            setError(contentResponse.error);
            _setUnitConfig(undefined);
            return;
          }
          _setUnitConfig(contentResponse.content);
        })
        .catch((err) => {
          setError(err.message);
          _setUnitConfig(undefined);
        });

      // maybe fetch teacher guide content (it might not exist so we don't treat failure as an error)
      api
        .get("/getContent", { branch, unit, path: "teacher-guide/content.json" })
        .then((contentResponse) => {
          if (!contentResponse.success) {
            setTeacherGuideConfig(undefined);
            return;
          }
          setTeacherGuideConfig(contentResponse.content);
        })
        .catch((err) => {
          setTeacherGuideConfig(undefined);
        });
    }

    // Note: we don't have a cleanup function to turn off the listener
    // because we want to keep listening for changes until branch or unit changes.
    // The filesRef.current?.off() above is what turns off the previous listener.
  }, [api, branch, setError, setFiles, _setUnitConfig, setTeacherGuideConfig, unit]);

  const saveContent = useCallback(async (contentPath: string, updatedContent: any) => {
    if (!branch || !unit) {
      return;
    }

    window.clearTimeout(saveStateClearTimeoutRef.current);
    setSaveState("saving");
    return api
      .post(
        "/putContent",
        { branch, unit, path: contentPath },
        { content: updatedContent }
      )
      .then((response) => {
        if (response.success) {
          setSaveState("saved");
          setError(undefined);
          saveStateClearTimeoutRef.current = window.setTimeout(() => {
            setSaveState(undefined);
          }, 1000);
          authoringPreview.reloadAllPreviews();
        } else {
          setSaveState("error");
          setError(response.error);
        }
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [api, branch, unit, setError, setSaveState, authoringPreview]);

  useEffect(() => {
    // save unit config changes
    if (unitConfig && saveUnitConfigRef.current && branch && unit) {
      saveUnitConfigRef.current = false;
      saveContent("content.json", unitConfig);
    }
  }, [branch, unit, unitConfig, saveContent]);

  useEffect(() => {
    const newExemplarFiles = Object.entries(files || {})
      .filter(([_key, file]) => file.type === "exemplar")
      .reduce<ExemplarFile[]>((acc, [exemplarPath, file]) => {
        acc.push({
          path: exemplarPath,
          title: file.title ?? "Unknown Exemplar",
        });
        return acc;
      }, []);
    setExemplarFiles(newExemplarFiles);
  }, [files, setExemplarFiles]);

  const value: CurriculumContextValue = {
    branch,
    setBranch,
    unit,
    setUnit,
    unitConfig,
    setUnitConfig,
    teacherGuideConfig,
    setTeacherGuideConfig,
    error,
    setError,
    path,
    files,
    reset,
    saveState,
    branchMetadata,
    exemplarFiles,
    saveContent
  };

  return (
    <CurriculumContext.Provider value={value}>
      {children}
    </CurriculumContext.Provider>
  );
};

export const useCurriculum = (): CurriculumContextValue => {
  const ctx = useContext(CurriculumContext);
  if (!ctx) {
    throw new Error("useCurriculum must be used within a CurriculumProvider");
  }
  return ctx;
};
