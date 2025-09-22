import React, { useCallback, useEffect, useMemo } from "react";
import { useImmer } from "use-immer";

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
  const [expanded, setExpanded] = useImmer<Record<string, boolean>>({
    [basePath]: true
  });
  const [hashChangeCount, setHashChangeCount] = useImmer(0);
  const lastHashChangeCount = React.useRef(-1);

  const handleToggle = (path: string) => setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  const onHashChange = useCallback(() => setHashChangeCount(prev => prev + 1), [setHashChangeCount]);

  const tree = useMemo<TreeNode>(() => {
    return {
      id: "root",
      label: "Curriculum",
      children: [
      {
        id: "config",
        label: "Configuration",
        children: [
          { id: "curriculumTabs", label: "Curriculum Tabs"},
          { id: "teacherGuideTabs", label: "Teacher Guide Tabs"},
          { id: "unitSettings", label: "Unit Settings", tbd: true}
        ]
      },
      {
        id: "content",
        label: "Content",
        children: [
          {
            id: "investigations",
            label: "Investigations",
              children: unitConfig.investigations?.map(inv => ({
              id: `investigation-${inv.ordinal}`,
              label: inv.title,
              children: inv.problems?.map(prob => ({
                id: `problem-${prob.ordinal}`,
                label: prob.title,
                children: prob.sections?.map((sec, index) => {
                  const problemTab = unitConfig.config.navTabs.tabSpecs.find(t => t.tab === "problems");
                  const sectionTab = problemTab?.sections?.[index];
                  return {
                    id: sec,
                    label: sectionTab?.title ?? `Unknown Section Number (${index})`,
                  };
                }) || [],
              })) || []
            })) || []
          },
          {
            id: "teacherGuides",
            label: "Teacher Guides",
            tbd: true,
          },
          {
            id: "exemplars",
            label: "Exemplars",
            tbd: true,
          }
        ]
      }]
    };
  }, [unitConfig]);

  useEffect(() => {
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [onHashChange]);

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
  }, [tree, hashChangeCount, basePath, setExpanded]);

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
