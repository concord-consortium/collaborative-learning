
import React, { useEffect, useRef } from "react";

import "./workspace.scss";
import { IUnit } from "../types";
import { IframeControl } from "./iframe-control";
import RawSettingsControl from "./raw-settings-control";
import { AuthoringApi } from "../hooks/use-authoring-api";

interface IProps {
  branch: string;
  unit: string;
  unitConfig: IUnit;
  path: string | undefined;
  api: AuthoringApi
}

const Workspace: React.FC<IProps> = ({ branch, unit, path, api }) => {
  const [content, setContent] = React.useState<any>({});
  const [status, setStatus] = React.useState<"loading" | "loaded" | "notImplemented" | "error">("loading");
  const [contentPath, setContentPath] = React.useState<string | undefined>(undefined);
  const lastContentPathRef = useRef<string | undefined>(undefined);

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
  }, [path, api, unit]);

  useEffect(() => {
    if (!contentPath || contentPath === lastContentPathRef.current) {
      return;
    }
    lastContentPathRef.current = contentPath;

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
  }, [contentPath, api, branch, unit]);

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
