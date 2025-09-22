import { useCallback, useEffect } from "react";
import { useImmer } from "use-immer";

export type AuthState = "unauthenticated" | "authenticating" | "authenticated" | "error";

import { data } from "../data/data";
import { IUnit } from "../types";

export const units = ["cas", "mods", "brain", "m2s"];
export const branches = ["main", "demo"];

const anyData = data as any;

export const useCurriculum = () => {
  const [authState, setAuthState] = useImmer<AuthState>("authenticated");
  const [branch, _setBranch] = useImmer<string | undefined>(undefined);
  const [unit, _setUnit] = useImmer<string | undefined>(undefined);
  const [path, setPath] = useImmer<string | undefined>(undefined);
  const [unitConfig, setUnitConfig] = useImmer<IUnit | undefined>(undefined);
  const [error, setError] = useImmer<string | undefined>(undefined);

  const reset = useCallback(() => {
    setError(undefined);
    _setBranch(undefined);
    _setUnit(undefined);
    setUnitConfig(undefined);
  }, [_setBranch, _setUnit, setError, setUnitConfig]);

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
        ? `#/${branch}/${newUnit}/config/curriculumTabs`
        : (branch ? `#/${branch}` : "#");
    }
  }, [_setUnit, branch, setError, setUnitConfig]);

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

    if (_branch !== branch) {
      setBranch(_branch);
    }
    if (_unit !== unit) {
      setUnit(_unit);
    }
    setPath(rest.length > 0 ? rest.join("/") : undefined);
  }, [branch, unit, setBranch, setUnit, setPath]);

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
    setUnitConfig,
    error,
    setError,
    path,
    loadFile,
  };
};
