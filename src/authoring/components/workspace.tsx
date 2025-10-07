
import React, { useEffect, useRef } from "react";
import { useImmer } from "use-immer";
import classNames from "classnames";

import { IframeControl } from "./editors/iframe-control";
import RawSettingsControl from "./editors/raw-settings-control";
import { useAuthoringApi } from "../hooks/use-authoring-api";
import CurriculumTabs from "./workspace/curriculum-tabs";
import { useCurriculum } from "../hooks/use-curriculum";
import NavTabs from "./workspace/nav-tabs";
import AISettings from "./workspace/ai-settings";
import { useAuthoringPreview } from "../hooks/use-authoring-preview";

import "./workspace.scss";

const Workspace: React.FC = () => {
  const api = useAuthoringApi();
  const { branch, unit, path, unitConfig, setUnitConfig } = useCurriculum();
  const authoringPreview = useAuthoringPreview();
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
    if (!branch || !unit || !contentPath || contentPath === lastContentPathRef.current) {
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
    if (!contentPath || !branch || !unit) {
      return;
    }

    try {
      // the content updated by the iframe is the inner content field
      const updatedContent = {...content, content: JSON.parse(newContent)};
      api.post("/putContent", { branch, unit, path: contentPath }, {content: updatedContent}).then((response) => {
        if (response.success) {
          authoringPreview.reloadAllPreviews();
        } else {
          console.error("Error saving content:", response.error);
        }
      }).catch((err) => {
        console.error("Error saving content:", err);
      });
    } catch (e) {
      console.error("Error parsing content as JSON:", e);
    }
  };

  const handleSaveRawUnitConfig = (newConfig: any) => {
    setUnitConfig(newConfig);
  };

  const renderConfig = () => {
    switch (path) {
      case "config/raw":
        return <RawSettingsControl initialValue={unitConfig} onSave={handleSaveRawUnitConfig} />;
      case "config/curriculumTabs":
        return <CurriculumTabs />;
      case "config/navTabs":
        return <NavTabs />;
      case "config/aiSettings":
        return <AISettings />;
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
      return (
        <IframeControl
          key={contentPath}
          initialValue={content.content}
          onChange={onChangeContent}
        />
      );
    }
    return <div className="centered muted">No content available.</div>;
  };

  const className = classNames("workspace", {
    "overflowing": isConfigPath && path !== "config/raw",
  });

  return (
    <div className={className}>
      {renderContent()}
    </div>
  );
};

export default Workspace;
