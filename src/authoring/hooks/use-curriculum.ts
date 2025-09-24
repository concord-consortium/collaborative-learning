import { useCallback, useEffect, useRef, useState } from "react";

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

  const reset = () => {
    setError(undefined);
    _setBranch(undefined);
    _setUnit(undefined);
    setUnitConfig(undefined);
  };

  const setUnit = useCallback((newUnit?: string, updateHash?: boolean) => {
    // wait until we have a branch and a new unit
    if (branch && newUnit && newUnit === lastUnitRef.current) {
      return;
    }

    if (branch && newUnit) {
      lastUnitRef.current = newUnit;

      // fetch files and content in parallel
      const filesPromise = api.get("/getPulledFiles", { branch, unit: newUnit });
      const contentPromise = api.get("/getContent", { branch, unit: newUnit, path: "content.json" });
      Promise.all([filesPromise, contentPromise]).then(([filesResponse, contentResponse]) => {
        if (!filesResponse.success || !contentResponse.success) {
          setError(filesResponse.error || contentResponse.error);
          setUnitConfig(undefined);
          return;
        }

        setFiles(filesResponse.files);
        setUnitConfig(contentResponse.content);
      }).catch((err) => {
        setError(err.message);
        setUnitConfig(undefined);
      });
    }
    _setUnit(newUnit);
    if (updateHash) {
      window.location.hash = branch && newUnit
        ? `#/${branch}/${newUnit}/config/unitSettings`
        : (branch ? `#/${branch}` : "#");
    }
  }, [api, branch]);

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
    if (auth.user) {
      processHash();
    }
  }, [auth, processHash]);

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
    files
  };
};
