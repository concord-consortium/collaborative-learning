
import React, { ReactNode, useEffect, useMemo, useRef } from "react";
import { useImmer } from "use-immer";
import classNames from "classnames";

import { IframeControl } from "./editors/iframe-control";
import RawSettingsControl from "./editors/raw-settings-control";
import { useAuthoringApi } from "../hooks/use-authoring-api";
import CurriculumTabs from "./workspace/curriculum-tabs";
import { useCurriculum } from "../hooks/use-curriculum";
import NavTabs from "./workspace/nav-tabs";
import AISettings from "./workspace/ai-settings";
import ChatTutorSettings from "./workspace/chat-tutor-settings";
import CommentsSettings from "./workspace/comments-settings";
import SortWorkSettings from "./workspace/sort-work-settings";
import { TermOverridesSettings } from "./workspace/term-overrides-settings";
import DocumentSettings from "./workspace/document-settings";
import PlanningTemplateEditor from "./workspace/planning-template-editor";
import ExemplarMetadata from "./editors/exemplar-metadata";
import { ContainerConfig } from "./workspace/container-config/container-config";
import { isProblem } from "./workspace/container-config/container-config-helpers";
import { TemplateEditor } from "./editors/template-editor";
import { getCurriculumItem, getUnitItem } from "../utils/nav-path";
import { IProblem } from "../types";

import "./workspace.scss";

const Workspace: React.FC = () => {
  const api = useAuthoringApi();
  const { branch, unit, path, unitConfig, setUnitConfig, teacherGuideConfig, setTeacherGuideConfig,
          files, saveContent } = useCurriculum();
  const [content, setContent] = useImmer<any>({});
  const [status, setStatus] = useImmer<"loading" | "loaded" | "notImplemented" | "error">("loading");
  const [contentPath, setContentPath] = useImmer<string | undefined>(undefined);
  const lastContentPathRef = useRef<string | undefined>(undefined);
  const isConfigPath = path?.startsWith("config/") || path?.endsWith("/containerConfig");
  const contentRef = useRef(content);

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
    // For the config paths we are going to be setting the status incorrectly here
    // but the status is ignored when isConfigPath is true
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

  // keep a ref to the latest content for callbacks so that we don't have to
  // wrap all of them in useCallback - this ref is also updated when content
  // is saved in saveContent()
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const contentType = useMemo(() => {
    if (!contentPath || !files) {
      return undefined;
    }
    const fileEntry = files[contentPath];
    return fileEntry?.type;
  }, [contentPath, files]);

  const onChangeMetadata = (metadata: any) => {
    saveIFrameContent({...metadata, content: contentRef.current.content});
  };

  const exemplarTags = unitConfig?.config?.aiPrompt?.categories ?? [];

  const onChangeInnerContent = (newInnerContent: string) => {
    try {
      // the content updated by the iframe is the inner content field
      if (!contentRef.current) {
        console.error("contentRef.current is null in onChangeInnerContent");
        return;
      }
      const updatedContent = {...contentRef.current, content: JSON.parse(newInnerContent)};
      saveIFrameContent(updatedContent);
    } catch (e) {
      console.error("Error parsing content as JSON:", e);
    }
  };

  const onChangeRawContent = (newRawContent: string) => {
    try {
      const updatedContent = JSON.parse(newRawContent);
      saveIFrameContent(updatedContent);
    } catch (e) {
      console.error("Error parsing raw content as JSON:", e);
    }
  };

  const saveIFrameContent = (updatedContent: any) => {
    if (!contentPath) {
      return;
    }
    contentRef.current = updatedContent;
    saveContent(contentPath, updatedContent);
  };

  const handleSaveRawUnitConfig = (newConfig: any) => {
    setUnitConfig(newConfig);
  };

  const renderConfig = () => {
    if (path?.endsWith("/containerConfig")) {
      return <ContainerConfig key={path} path={path} />;
    }

    switch (path) {
      case "config/raw":
        return <RawSettingsControl initialValue={unitConfig} onSave={handleSaveRawUnitConfig} />;
      case "config/curriculumTabs":
        return <CurriculumTabs />;
      case "config/navTabs":
        return <NavTabs />;
      case "config/aiSettings":
        return <AISettings />;
      case "config/chatTutorSettings":
        return <ChatTutorSettings />;
      case "config/commentsSettings":
        return <CommentsSettings />;
      case "config/sortWorkSettings":
        return <SortWorkSettings />;
      case "config/termOverrides":
        return <TermOverridesSettings />;
      case "config/documentSettings":
        return <DocumentSettings />;
      case "config/documentTemplate":
        return (
          <TemplateEditor
            value={unitConfig?.config?.defaultDocumentTemplate}
            onChange={(v) => setUnitConfig(draft => { if (draft) draft.config.defaultDocumentTemplate = v; })}
          />
        );
      case "config/planningTemplate":
        return (
          <PlanningTemplateEditor
            planningTemplate={unitConfig?.config?.planningTemplate}
            onChange={(sectionType, sectionContent) => setUnitConfig(draft => {
              if (!draft) return;
              if (!draft.config.planningTemplate) draft.config.planningTemplate = {};
              draft.config.planningTemplate[sectionType] = sectionContent;
            })}
          />
        );
      default:
        return <div className="centered muted">Not yet implemented.</div>;
    }
  };

  // Per-problem / teacher-guide template editor pages (full-height, bound to the item's config).
  const renderItemTemplate = () => {
    const m = path && /^(investigations|teacher-guides)\/(.+)\/(documentTemplate|planningTemplate)$/.exec(path);
    if (!m) return undefined;
    const itemPath = `${m[1]}/${m[2]}`;
    const kind = m[3];
    const isTG = m[1] === "teacher-guides";
    const setConfig = isTG ? setTeacherGuideConfig : setUnitConfig;
    const item = getCurriculumItem(unitConfig, teacherGuideConfig, itemPath);
    if (!item || !isProblem(item)) {
      return <div className="centered muted">Templates are only available for problems.</div>;
    }
    const pathParts = itemPath.split("/");
    const updateItemConfig = (mutate: (config: NonNullable<IProblem["config"]>) => void) => {
      setConfig(draft => {
        const draftItem = getUnitItem(draft, pathParts);
        if (draftItem && isProblem(draftItem)) {
          if (!draftItem.config) draftItem.config = {};
          mutate(draftItem.config);
        }
      });
    };
    if (kind === "documentTemplate") {
      return (
        <TemplateEditor
          value={item.config?.defaultDocumentTemplate}
          onChange={(v) => updateItemConfig(c => { c.defaultDocumentTemplate = v; })}
        />
      );
    }
    return (
      <PlanningTemplateEditor
        planningTemplate={item.config?.planningTemplate}
        onChange={(sectionType, sectionContent) => updateItemConfig(c => {
          if (!c.planningTemplate) c.planningTemplate = {};
          c.planningTemplate[sectionType] = sectionContent;
        })}
      />
    );
  };

  const renderContent = () => {
    const itemTemplate = renderItemTemplate();
    if (itemTemplate) return itemTemplate;

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
      let headerContent: ReactNode | undefined = undefined;
      switch (contentType) {
        case "exemplar":
          headerContent = content &&
            <ExemplarMetadata
              title={content.title}
              tag={content.tag}
              tags={exemplarTags}
              onChange={onChangeMetadata}
            />;
          break;
        default:
          headerContent = undefined;
      }

      return (
        <IframeControl
          key={contentPath}
          initialValue={content.content}
          rawContent={content}
          onChange={onChangeInnerContent}
          onRawChange={onChangeRawContent}
          headerContent={headerContent}
        />
      );
    }
    return <div className="centered muted">No content available.</div>;
  };

  // These config paths render a full-height editor (not a scrolling form), like the raw JSON editor.
  const fullEditorConfigPaths = ["config/raw", "config/documentTemplate", "config/planningTemplate"];
  const className = classNames("workspace", {
    "overflowing": isConfigPath && !fullEditorConfigPaths.includes(path ?? ""),
  });

  return (
    <div className={className}>
      {renderContent()}
    </div>
  );
};

export default Workspace;
