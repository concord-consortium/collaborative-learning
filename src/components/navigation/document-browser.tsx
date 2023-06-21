import React, { useMemo } from "react";
import { observer } from "mobx-react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { DocumentModelType } from "../../models/document/document";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { ENavTabSectionType, NavTabSpec } from "../../models/view/nav-tabs";
import { useAppConfig, useUIStore } from "../../hooks/use-stores";
import { LogEventName } from "../../lib/logger-types";
import { DocumentCollectionByType } from "../thumbnail/documents-type-collection";
import { DocumentDragKey, SupportPublication } from "../../models/document/document-types";
import { ISubTabSpec } from "./section-document-or-browser";

import "./section-document-or-browser.sass";

const kNavItemScale = 0.11;
const kHeaderHeight = 55;
const kWorkspaceContentMargin = 4;
const kNavTabHeight = 34;
const kTabSectionBorderWidth = 2;

interface IProps {
  tabSpec: NavTabSpec;
  selectedDocument?: string;
  selectedSection?: ENavTabSectionType;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
}

// FIXME: we need a better name here. We have:
// - DocumentOrBrowser which is the parent
// - SectionDocumentOrBrowser which is what this is copied and simplified from
export const DocumentBrowser: React.FC<IProps> = observer(function DocumentBrowser(
    { tabSpec, selectedDocument, onSelectNewDocument, onSelectDocument }) {
  const ui = useUIStore();
  const appConfigStore = useAppConfig();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);

  const subTabs = useMemo<ISubTabSpec[]>(() => {
    const _subTabs: ISubTabSpec[] = [];
    // combine sections with matching titles into a single tab with sub-sections
    tabSpec.sections?.forEach(section => {
      const found = _subTabs.findIndex(tab => tab.label === section.title);
      if (found >= 0) {
        _subTabs[found].sections.push(section);
      }
      else {
        _subTabs.push({ label: section.title, sections: [section] });
      }
    });
    return _subTabs;
  }, [tabSpec.sections]);

  const hasSubTabs = subTabs.length > 1;
  const vh = window.innerHeight;
  const headerOffset = hasSubTabs
                        ? kHeaderHeight + (2 * (kWorkspaceContentMargin + kNavTabHeight + kTabSectionBorderWidth))
                        : kHeaderHeight + kNavTabHeight + (2 * (kWorkspaceContentMargin + kTabSectionBorderWidth));
  const documentsPanelHeight = vh - headerOffset;
  const documentsPanelStyle = { height: documentsPanelHeight };

  const handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => {
    e.dataTransfer.setData(DocumentDragKey, document.key);
  };

  const handleDocumentDeleteClick = (document: DocumentModelType) => {
    ui.confirm("Do you want to delete this?", "Confirm Delete")
      .then(ok => {
        if (ok) {
          document.setProperty("isDeleted", "true");
          if (document.type === SupportPublication) {
            logDocumentEvent(LogEventName.DELETE_SUPPORT, { document });
          }
        }
      });
  };

  const renderDocumentBrowserView = (subTab: ISubTabSpec) => {
    return (
      <div>
        {
          subTab.sections.map((section: any, index: any) => {
            return (
              <DocumentCollectionByType
                key={`${section.type}_${index}`}
                topTab={navTabSpec?.tab}
                tab={subTab.label}
                section={section}
                index={index}
                numSections={subTab.sections.length}
                scale={kNavItemScale}
                selectedDocument={selectedDocument}
                onSelectNewDocument={onSelectNewDocument}
                onSelectDocument={onSelectDocument}
                onDocumentDragStart={handleDocumentDragStart}
                onDocumentDeleteClick={handleDocumentDeleteClick}
              />
            );
          })
        }
      </div>
    );
  };

  return (
    <div className="document-tab-content">
      <Tabs
        className={`document-tabs ${navTabSpec?.tab}`}
        forceRenderTabPanel={true}
        selectedTabClassName="selected"
      >
        <div className={`tab-header-row ${!hasSubTabs ? "no-sub-tabs" : ""}`}>
          <TabList className={`tab-list ${navTabSpec?.tab}`}>
            {subTabs.map((subTab) => {
              const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
              const type = subTab.sections[0].type;
              return (
                <Tab className={`doc-tab ${navTabSpec?.tab} ${sectionTitle} ${type}`}
                  key={`section-${sectionTitle}`}>
                  {subTab.label}
                </Tab>
              );
            })}
          </TabList>
        </div>
        <div className="documents-panel" style={documentsPanelStyle}>
          {subTabs.map((subTab, index) => {
            const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
            return (
              <TabPanel key={`subtab-${subTab.label}`} data-test={`subtab-${sectionTitle}`}>
                { renderDocumentBrowserView(subTab) }
              </TabPanel>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
});
