
import React, { useEffect } from "react";

import "./workspace.scss";
import { IUnit } from "../types";
import { IframeControl } from "./iframe-control";
import RawSettingsControl from "./raw-settings-control";

interface IProps {
  branch: string;
  unit: string;
  unitConfig: IUnit;
  path: string | undefined;
  loadFile: (unitFilePath: string) => Promise<any>;
}

const Workspace: React.FC<IProps> = ({ branch, unit, unitConfig, path, loadFile }) => {
  const [content, setContent] = React.useState<any>({});
  const [status, setStatus] = React.useState<"loading" | "loaded" | "notImplemented" | "error">("loading");

  useEffect(() => {
    if (path?.includes("/sections/")) {
      // load the content file for the selected path - some of the sections weirdly start with "sections/"
      // so strip that out if present
      const [_, ...parts] = path.split("/sections/");
      const contentPath = parts.join("/").replace(/^sections\//, "");

      setStatus("loading");
      loadFile(`${unit}/${contentPath}`).then((data) => {
        setContent(data);
        setStatus("loaded");
      }).catch((err) => {
        setStatus("error");
        console.error("Error loading content:", err);
      });
      return;
    }

    if (path === "config/raw") {
      setStatus("loading");
      loadFile(`${unit}/content.json`).then((data) => {
        setContent(data);
        setStatus("loaded");
      }).catch((err) => {
        setStatus("error");
        console.error("Error loading content:", err);
      });
      return;
    }

    setContent("");
    setStatus("notImplemented");
  }, [path, loadFile, unit]);

  const renderContent = () => {
    if (status === "loading") {
      return <div className="centered">Loading content...</div>;
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
