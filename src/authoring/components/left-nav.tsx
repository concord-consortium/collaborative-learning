import React, { useEffect, useMemo, useState } from "react";
import "./left-nav.scss";
import { IUnit } from "../types";

// Tree node type
export interface TreeNode {
  id: string;
  label: string;
  tbd?: boolean;
  children?: TreeNode[];
}

interface IProps {
  branch: string;
  unit: string;
  unitConfig: IUnit;
}

const LeftNav: React.FC<IProps> = ({ unitConfig, branch, unit }) => {
  const basePath = `#/${branch}/${unit}`;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    [basePath]: true
  });
  const sectionKeys = Object.keys(unitConfig.sections || {});
  const [hashChangeCount, setHashChangeCount] = useState(0);

  const handleToggle = (path: string) => setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  const onHashChange = () => setHashChangeCount(prev => prev + 1);

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
            id: "unitSettings",
            label: "Unit Settings",
            tbd: true
          },
          {
            id: "curriculumTabs",
            label: "Curriculum Tabs",
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
                children: prob.sections?.map(sec => {
                      const parts = sec.split("/");
                      let section: typeof unitConfig.sections[string] | undefined;
                      for (const part of parts) {
                        if (sectionKeys.includes(part)) {
                          section = unitConfig.sections?.[part];
                          break;
                        }
                      }
                      return {
                        id: sec,
                        label: section?.title ?? `Unknown Section (${sec})`,
                      };
                    }) || [],
              })) || []
        })) || []
      }
    ]};
  }, [unitConfig, sectionKeys]);

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
    const isSelected = window.location.hash === path;

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
              window.location.hash = path;
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
      <ul className="tree-view">
        {renderNode(tree, basePath)}
      </ul>
    </nav>
  );
};

export default LeftNav;
