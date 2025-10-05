import { useCallback, useEffect, useRef } from "react";
import firebase from "firebase/app";
import { Updater, useImmer } from "use-immer";

export type SaveState = "saving" | "saved" | "error" | undefined;

import { IUnit, IUnitFiles } from "../types";
import { AuthoringApi } from "./use-authoring-api";
import { Auth } from "./use-auth";
import { AuthoringPreview } from "./use-authoring-preview";

export const units = ["cas", "mods", "brain", "m2s"];
export const branches = ["authoring-testing"];

export const useCurriculum = (auth: Auth, api: AuthoringApi, authoringPreview: AuthoringPreview) => {
  const [branch, _setBranch] = useImmer<string | undefined>(undefined);
  const [unit, _setUnit] = useImmer<string | undefined>(undefined);
  const [path, setPath] = useImmer<string | undefined>(undefined);
  const [unitConfig, _setUnitConfig] = useImmer<IUnit | undefined>(undefined);
  const [files, setFiles] = useImmer<IUnitFiles | undefined>(undefined);
  const [error, setError] = useImmer<string | undefined>(undefined);
  const lastUnitRef = useRef<string | undefined>(undefined);
  const filesRef = useRef<firebase.database.Reference | undefined>(undefined);
  const [saveState, setSaveState] = useImmer<SaveState | undefined>(undefined);
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

  const setUnit = useCallback((newUnit?: string, updateHash?: boolean) => {
    _setUnit(newUnit);
    if (updateHash) {
      window.location.hash = branch && newUnit
        ? `#/${branch}/${newUnit}/config/curriculumTabs`
        : (branch ? `#/${branch}` : "#");
    }
  }, [_setUnit, branch]);

  const setBranch = useCallback((newBranch?: string, updateHash?: boolean) => {
    if (newBranch && !branches.includes(newBranch)) {
      setError(`Branch ${newBranch} not found`);
      reset();
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
  }, [_setBranch, branch, reset, setError]);

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

  useEffect(() => {
    // wait until auth is ready
    if (auth.firebaseToken && auth.gitHubToken) {
      processHash();
    } else {
      reset();
    }
  }, [auth.firebaseToken, auth.gitHubToken, processHash, reset]);

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
      filesRef.current = firebase.database().ref(`authoring/content/branches/${branch}/units/${unit}/files`);
      filesRef.current.on("value", onFilesChange);

      // fetch content
      api.get("/getContent", { branch, unit, path: "content.json" }).then((contentResponse) => {
        if (!contentResponse.success) {
          setError(contentResponse.error);
          _setUnitConfig(undefined);
          return;
        }
        _setUnitConfig(contentResponse.content);
      }).catch((err) => {
        setError(err.message);
        _setUnitConfig(undefined);
      });
    }

    // Note: we don't have a cleanup function to turn off the listener
    // because we want to keep listening for changes until branch or unit changes.
    // The filesRef.current?.off() above is what turns off the previous listener.
  }, [api, branch, setError, setFiles, _setUnitConfig, unit]);

  useEffect(() => {
    // save unit config changes
    if (unitConfig && saveUnitConfigRef.current && branch && unit) {
      saveUnitConfigRef.current = false;
      window.clearTimeout(saveStateClearTimeoutRef.current);
      setSaveState("saving");
      api.post("/putContent", { branch, unit, path: "content.json"}, {content: unitConfig }).then((response) => {
        if (response.success) {
          setSaveState("saved");
          saveStateClearTimeoutRef.current = window.setTimeout(() => {
            setSaveState(undefined);
          }, 1000);
          authoringPreview.reloadAllPreviews();
        } else {
          setSaveState("error");
          setError(response.error);
        }
      }).catch((err) => {
        setError(err.message);
      });
    }
  }, [api, branch, unit, unitConfig, setError, setSaveState, authoringPreview]);

  const listBranches = async () => {
    return branches;
  };

  const listUnits = async (_branch: string) => {
    // Simulate an API call to fetch units for a given branch
    return units;
  };

  return {
    branch,
    setBranch,
    unit,
    setUnit,
    listBranches,
    listUnits,
    unitConfig,
    setUnitConfig,
    error,
    setError,
    path,
    files,
    reset,
    saveState
  };
};
