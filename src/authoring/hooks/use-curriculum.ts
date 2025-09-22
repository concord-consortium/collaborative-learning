import { useCallback, useEffect, useState } from "react";

export type AuthState = "unauthenticated" | "authenticating" | "authenticated" | "error";

import { data } from "../data/data";
import { IUnit } from "../types";

export const units = ["cas", "mods", "brain", "m2s"];
export const branches = ["main", "demo"];

const anyData = data as any;

export const useCurriculum = () => {
  const [authState, setAuthState] = useState<AuthState>("authenticated");
  const [branch, _setBranch] = useState<string | undefined>(undefined);
  const [unit, _setUnit] = useState<string | undefined>(undefined);
  const [path, setPath] = useState<string | undefined>(undefined);
  const [unitConfig, setUnitConfig] = useState<IUnit | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const reset = () => {
    setError(undefined);
    _setBranch(undefined);
    _setUnit(undefined);
    setUnitConfig(undefined);
  };

  const setUnit = useCallback((newUnit?: string, updateHash?: boolean) => {
    if (newUnit) {
      const key = `${newUnit}/content.json`;
      if (anyData[key]) {
        setError(undefined);
        setUnitConfig(anyData[key]);
      } else {
        setError(`Unit ${newUnit} not found`);
        setUnitConfig(undefined);
      }
    }
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
    processHash();
  }, [processHash]);

  const listBranches = async () => {
    return branches;
  };

  const listUnits = async (_branch: string) => {
    // Simulate an API call to fetch units for a given branch
    return units;
  };

  const loadFile = async (unitFilePath: string) => {
    if (anyData[unitFilePath]) {
      return anyData[unitFilePath];
    } else {
      throw new Error(`File ${unitFilePath} not found`);
    }
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
    loadFile,
  };
};
