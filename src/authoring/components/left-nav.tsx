import React, { useEffect, useMemo, useState } from "react";
import "./left-nav.scss";
import { IUnit, IUnitFiles } from "../types";

// Tree node type
export interface TreeNode {
  id: string;
  label: string;
  tbd?: boolean;
  path?: string;
  children?: TreeNode[];
}

interface IProps {
  branch: string;
  unit: string;
  unitConfig: IUnit;
  files: IUnitFiles;
  showMediaLibrary: boolean;
  onMediaLibraryClicked?: () => void;
}

const LeftNav: React.FC<IProps> = ({ unitConfig, branch, unit, files, showMediaLibrary, onMediaLibraryClicked }) => {
  const basePath = `#/${branch}/${unit}`;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    [basePath]: true
  });
  const [hashChangeCount, setHashChangeCount] = useState(0);

  const handleToggle = (path: string) => setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  const onHashChange = () => setHashChangeCount(prev => prev + 1);
  const lastHashChangeCount = React.useRef(-1);

  const tree = useMemo<TreeNode>(() => {
    return {
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
            id: "unitSettings",
            label: "Unit Settings",
            tbd: true
          },
          {
            id: "teacherGuideTabs",
            label: "Teacher Guide Tabs",
            tbd: true
          },
          {
            id: "investigations",
            label: "Investigations",
            tbd: true
          },
          {
            id: "raw",
            label: "Raw Settings (Dev Only)"
          },
        ]
      },
      {
        id: "investigations",
        label: "Investigations",
          children: unitConfig.investigations?.map(inv => ({
          id: `investigation-${inv.ordinal}`,
          label: inv.title,
          children: inv.problems?.map(prob => ({
            id: `problem-${prob.ordinal}`,
            label: prob.title,
            children: prob.sections?.map((sectionPath, index) => {
              const file = files[sectionPath];
              const section = file && file.type ? unitConfig.sections?.[file.type] : undefined;
              return {
                id: `section-${index+1}`,
                label: section?.title ?? `Unknown Section (${sectionPath})`,
                path: sectionPath
              };
            }) || [],
          })) || []
        })) || []
      }
    ]};
  }, [unitConfig, files]);

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

    // prevent infinite loop
    if (lastHashChangeCount.current !== hashChangeCount) {
      lastHashChangeCount.current = hashChangeCount;
      expandTree(tree, basePath);
    }
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
          {showMediaLibrary ? "Close" : "Open"} Media Library
        </button>
      </div>
    </nav>
  );
};

export default LeftNav;
