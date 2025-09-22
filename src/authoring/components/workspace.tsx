
import React, { useCallback, useEffect } from "react";
import { useImmer, Updater } from "use-immer";

import { IUnit } from "../types";
import { IframeControl } from "./editors/iframe-control";
import RawSettingsControl from "./editors/raw-settings-control";
import CurriculumTabs from "./workspace/curriculum-tabs";

import "./workspace.scss";

type WorkspaceStatus = "loading" | "loaded" | "error" | "notImplemented";
interface IProps {
  branch: string;
  unit: string;
  unitConfig: IUnit;
  setUnitConfig: Updater<IUnit | undefined>;
  path: string | undefined;
  loadFile: (unitFilePath: string) => Promise<any>;
}

const Workspace: React.FC<IProps> = (props) => {
  const { unit, unitConfig, setUnitConfig, path } = props;
  const [content, setContent] = useImmer<any>({});
  const isConfigPath = path?.startsWith("config/");
  const [status, setStatus] = useImmer<WorkspaceStatus>(isConfigPath ? "loaded" : "loading");

  const loadFile = useCallback((contentPath: string) => {
    return new Promise<any>((resolve, reject) => {
      props.loadFile(`${unit}/${contentPath}`).then((data) => {
        setContent(data);
        setStatus("loaded");
        resolve(data);
      }).catch((err) => {
        setStatus("error");
        console.error("Error loading content:", err);
        resolve(undefined);
      });
    });
   }, [props, setContent, setStatus, unit]);

  useEffect(() => {
    if (isConfigPath) {
      // nothing to load for config pages - just use unitConfig
    } else if (path?.includes("/sections/")) {
      // load the content file for the selected path - some of the sections weirdly start with "sections/"
      // so strip that out if present
      const [_, ...parts] = path.split("/sections/");
      const contentPath = parts.join("/").replace(/^sections\//, "");

      loadFile(contentPath);

    } else if (path) {
      loadFile(path);
    } else {
      setContent(undefined);
      setStatus("notImplemented");
    }
  }, [path, isConfigPath, loadFile, unit, setContent, setStatus]);

  const renderConfig = () => {
    switch (path) {
      case "config/curriculumTabs":
        return <CurriculumTabs unitConfig={unitConfig} setUnitConfig={setUnitConfig} />;
      default:
        return <div className="centered muted">Not yet implemented.</div>;
    }
  };

  const renderContent = () => {
    if (isConfigPath) {
      return (
        <div className="config">
          {renderConfig()}
        </div>
      );
    }

    if (status === "loading") {
      return <div className="centered">Loading ...</div>;
    }
    if (status === "error") {
      return <div className="centered">Error loading content</div>;
    }
    if (status === "notImplemented") {
      return <div className="centered muted">This page not yet implemented.</div>;
    }
    if (status === "loaded" && content?.content) {
      return <IframeControl initialValue={content.content} />;
    }
    if (status === "loaded") {
      return <RawSettingsControl initialValue={content} />;
    }
    return <div className="centered muted">No content available.</div>;
  };

  return (
    <div className="workspace">
      {renderContent()}
    </div>
  );
};

export default Workspace;
