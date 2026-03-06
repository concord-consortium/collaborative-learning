import React, { useEffect, useMemo, useState } from "react";
import "./left-nav.scss";
import { useCurriculum } from "../hooks/use-curriculum";
import { useAuth } from "../hooks/use-auth";
import { getUnitChildrenTree } from "../utils/nav-path";

// Tree node type
export interface TreeNode {
  id: string;
  label: string;
  tbd?: boolean;
  path?: string;
  children?: TreeNode[];
}

interface IProps {
  onMediaLibraryClicked?: () => void;
}

const LeftNav: React.FC<IProps> = ({ onMediaLibraryClicked }) => {
  const { isAdminUser } = useAuth();
  const { unitConfig, teacherGuideConfig, branch, unit, files, exemplarFiles } = useCurriculum();
  const basePath = `#/${branch}/${unit}`;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    [basePath]: true
  });
  const [hashChangeCount, setHashChangeCount] = useState(0);

  const handleToggle = (path: string) => setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  const onHashChange = () => setHashChangeCount(prev => prev + 1);

  const tree = useMemo<TreeNode>(() => {
    const result = {
      id: "root",
      label: "Curriculum",
      children: [
        {
          id: "config",
          label: "Configuration",
          children: [
            {
              id: "curriculumTabs",
              label: "Curriculum Tabs",
            },
            {
              id: "navTabs",
              label: "Navigation Tabs",
            },
            {
              id: "aiSettings",
              label: "AI Settings",
            },
            {
              id: "sortWorkSettings",
              label: "Sort Work Settings",
            },
            {
              id: "termOverrides",
              label: "Term Overrides",
            },
          ]
        },
        {
          id: "investigations",
          label: "Investigations",
          children: getUnitChildrenTree(unitConfig, files),
        }
      ]
    };

    if (teacherGuideConfig) {
      result.children.push({
        id: "teacher-guides",
        label: "Teacher Guides",
        children: getUnitChildrenTree(teacherGuideConfig, files, "teacher-guide/"),
      });
    }

    if (exemplarFiles.length > 0) {
      result.children.push({
        id: "exemplars",
        label: "Exemplars",
        children: exemplarFiles.map(({path, title}) => ({
          id: path,
          label: title,
          path
        }))
      });
    }

    if (isAdminUser) {
      result.children[0].children!.push({
        id: "raw",
        label: "Raw Unit JSON (Admin Only)"
      } as any);
    }

    return result;
  }, [unitConfig, teacherGuideConfig, files, isAdminUser, exemplarFiles]);

  useEffect(() => {
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const expandTree = (node: TreeNode, path: string) => {
      if (window.location.hash.startsWith(path)) {
        setExpanded(prev => ({ ...prev, [path]: true }));
      }
      if (node.children) {
        node.children.forEach(child => expandTree(child, `${path}/${child.id}`));
      }
    };

    expandTree(tree, basePath);
  }, [tree, hashChangeCount, basePath]);

  const renderNode = (node: TreeNode, path: string) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded[path];
    const hashPath = node.path ? `${path}?content=${node.path}` : path;
    const isSelected = window.location.hash === hashPath;

    return (
      <li key={node.id}>
        <div
          className={
            "tree-node" +
            (isSelected ? " tree-node--selected" : "")
          }
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              handleToggle(path);
            } else {
              window.location.hash = hashPath;
            }
          }}
        >
          {hasChildren && (
            <span
              className="toggle"
            >
              {isExpanded ? "▼" : "▶"}
            </span>
          )}
          {node.label}
          {node.tbd && <span className="tbd"> TBD</span>}
        </div>
        {hasChildren && isExpanded && (
          <ul className="tree-children">
            {node.children!.map(child => renderNode(child, `${path}/${child.id}`))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav className="leftNav">
      <div className="tree-view-container">
        <ul className="tree-view">
          {renderNode(tree, basePath)}
        </ul>
      </div>
      <div className="leftNav-bottom">
        <button
          className="media-library-btn"
          onClick={onMediaLibraryClicked}
        >
          Media Library
        </button>
      </div>
    </nav>
  );
};

export default LeftNav;
