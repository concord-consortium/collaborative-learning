import { useCallback, useEffect, useRef, useState } from "react";
import firebase from "firebase/app";

export type AuthState = "unauthenticated" | "authenticating" | "authenticated" | "error";

import { IUnit, IUnitFiles } from "../types";
import { AuthoringApi } from "./use-authoring-api";
import { Auth } from "./use-auth";

export const units = ["cas", "mods", "brain", "m2s"];
export const branches = ["main", "demo"];

export const useCurriculum = (auth: Auth, api: AuthoringApi) => {
  const [authState, setAuthState] = useState<AuthState>("authenticated");
  const [branch, _setBranch] = useState<string | undefined>(undefined);
  const [unit, _setUnit] = useState<string | undefined>(undefined);
  const [path, setPath] = useState<string | undefined>(undefined);
  const [unitConfig, setUnitConfig] = useState<IUnit | undefined>(undefined);
  const [files, setFiles] = useState<IUnitFiles | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const lastUnitRef = useRef<string | undefined>(undefined);
  const filesRef = useRef<firebase.database.Reference | undefined>(undefined);

  const reset = () => {
    setError(undefined);
    _setBranch(undefined);
    _setUnit(undefined);
    setUnitConfig(undefined);
  };

  const setUnit = useCallback((newUnit?: string, updateHash?: boolean) => {
    _setUnit(newUnit);
    if (updateHash) {
      window.location.hash = branch && newUnit
        ? `#/${branch}/${newUnit}/config/unitSettings`
        : (branch ? `#/${branch}` : "#");
    }
  }, [branch]);

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
  }, [branch]);

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
    }
  }, [auth.firebaseToken, auth.gitHubToken, processHash]);

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
    if (branch && unit && lastUnitRef.current !== unit) {
      lastUnitRef.current = unit;

      // Setup a Firebase listener for the unit file changes so that we get real-time updates.
      // We only do direct reads - writes go through the API.
      filesRef.current = firebase.database().ref(`authoring/content/branches/${branch}/units/${unit}/files`);
      filesRef.current.on("value", onFilesChange);

      // fetch content
      api.get("/getContent", { branch, unit, path: "content.json" }).then((contentResponse) => {
        if (!contentResponse.success) {
          setError(contentResponse.error);
          setUnitConfig(undefined);
          return;
        }
        setUnitConfig(contentResponse.content);
      }).catch((err) => {
        setError(err.message);
        setUnitConfig(undefined);
      });
    }

    return () => {
      filesRef.current?.off();
      filesRef.current = undefined;
    };
  }, [api, branch, unit]);

  const listBranches = async () => {
    return branches;
  };

  const listUnits = async (_branch: string) => {
    // Simulate an API call to fetch units for a given branch
    return units;
  };

  return {
    authState,
    setAuthState,
    branch,
    setBranch,
    unit,
    setUnit,
    listBranches,
    listUnits,
    unitConfig,
    error,
    setError,
    path,
    files,
    reset
  };
};
