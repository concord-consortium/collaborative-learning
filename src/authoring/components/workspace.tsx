
import React, { useEffect, useRef } from "react";

import { IUnit } from "../types";
import { Updater, useImmer } from "use-immer";

import { IframeControl } from "./editors/iframe-control";
import RawSettingsControl from "./editors/raw-settings-control";
import { AuthoringApi } from "../hooks/use-authoring-api";
import CurriculumTabs from "./workspace/curriculum-tabs";
import { SaveState } from "../hooks/use-curriculum";

import "./workspace.scss";

interface IProps {
  branch: string;
  unit: string;
  unitConfig: IUnit;
  setUnitConfig: Updater<IUnit | undefined>;
  path: string | undefined;
  api: AuthoringApi
  saveState: SaveState;
}

const Workspace: React.FC<IProps> = ({ branch, unit, unitConfig, setUnitConfig, path, api, saveState }) => {
  const [content, setContent] = useImmer<any>({});
  const [status, setStatus] = useImmer<"loading" | "loaded" | "notImplemented" | "error">("loading");
  const [contentPath, setContentPath] = useImmer<string | undefined>(undefined);
  const lastContentPathRef = useRef<string | undefined>(undefined);
  const isConfigPath = path?.startsWith("config/");

  useEffect(() => {
    if (path === "config/raw") {
      setContentPath("config.json");
      return;
    }

    const pathParams = new URLSearchParams(path?.substring(path.indexOf("?")) || "");
    const contentParam = pathParams.get("content");
    if (contentParam) {
      setContentPath(contentParam);
      return;
    }

    setContentPath(undefined);
    setStatus("notImplemented");
  }, [path, api, unit, setContentPath, setStatus]);

  useEffect(() => {
    if (!contentPath || contentPath === lastContentPathRef.current) {
      return;
    }
    lastContentPathRef.current = contentPath;

    if (isConfigPath) {
      // nothing to load for config pages - just use unitConfig
      return;
    }

    setStatus("loading");
    api.get("/getContent", {branch, unit, path: contentPath}).then((response) => {
      if (response.success) {
        setContent(response.content);
        setStatus("loaded");
      } else {
        setStatus("error");
        console.error("Error loading content:", response.error);
      }
    }).catch((err) => {
      setStatus("error");
      console.error("Error loading content:", err);
    });
  }, [contentPath, api, branch, unit, isConfigPath, setContent, setStatus]);

  const onChangeContent = (newContent: string) => {
    if (!contentPath) {
      return;
    }

    try {
      // the content updated by the iframe is the inner content field
      const updatedContent = {...content, content: JSON.parse(newContent)};
      api.post("/putContent", { branch, unit, path: contentPath }, {content: updatedContent}).then((response) => {
        if (!response.success) {
          console.error("Error saving content:", response.error);
        }
      }).catch((err) => {
        console.error("Error saving content:", err);
      });
    } catch (e) {
      console.error("Error parsing content as JSON:", e);
    }
  };

  const renderConfig = () => {
    switch (path) {
      case "config/curriculumTabs":
        return <CurriculumTabs unitConfig={unitConfig} setUnitConfig={setUnitConfig} saveState={saveState} />;
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
      return <IframeControl key={contentPath} initialValue={content.content} onChange={onChangeContent} />;
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
