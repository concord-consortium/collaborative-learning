import React, { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useQueryClient } from 'react-query';
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { DocumentModelType } from "../../models/document/document";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { ENavTabSectionType, NavTabSectionSpec, NavTabSpec } from "../../models/view/nav-tabs";
import { EditableDocumentContent } from "../document/editable-document-content";
import { useAppConfig, useClassStore, useProblemStore, useUIStore, useUserStore } from "../../hooks/use-stores";
import { Logger, LogEventName } from "../../lib/logger";
import { useUserContext } from "../../hooks/use-user-context";
import { DocumentCollectionByType } from "../thumbnail/documents-type-collection";
import { DocumentDragKey, SupportPublication } from "../../models/document/document-types";
import { NetworkDocumentsSection } from "./network-documents-section";
import EditIcon from "../../clue/assets/icons/edit-right-icon.svg";

import "./section-document-or-browser.sass";

const kNavItemScale = 0.11;
const kHeaderHeight = 55;
const kWorkspaceContentMargin = 4;
const kNavTabHeight = 34;
const kTabSectionBorderWidth = 2;

interface IProps {
  tabSpec: NavTabSpec;
  reset?: () => void;
  selectedDocument?: string;
  selectedSection?: ENavTabSectionType;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
  onTabClick?: (title: string, type: string) => void;
  isChatOpen?: boolean;
}

export interface ISubTabSpec {
  label: string;
  sections: NavTabSectionSpec[];
}

export const SectionDocumentOrBrowser: React.FC<IProps> = ({ tabSpec, reset, selectedDocument,
  isChatOpen, onSelectNewDocument, onSelectDocument, onTabClick }) => {
  console.log("\n--------- < SectionDocumentOrBrowser > ---------");
  // console.log("selectedDocument:", selectedDocument);
  // console.log("onSelectNewDocument:", onSelectNewDocument);
  // console.log("onSelectDocument:", onSelectDocument);
  // console.log("tabSpec:", tabSpec.label.toUpperCase());
  const ui = useUIStore();
  console.log("line 48 fetch ui.selectedCommentedDocument:", ui.fetchSelectedCommentedDocument);

  const [referenceDocument, setReferenceDocument] = useState<DocumentModelType>(); //original
  // const [referenceDocument, setReferenceDocument] = useState<DocumentModelType>(); //added
  console.log("line 52 ui.selectedCommentedDocument:", ui.selectedCommentedDocument);
  // if (ui.selectedCommentedDocument !== undefined){ //this needs to trigger when ui.selectedComment triggers
  //   console.log("inside if");
  //   setReferenceDocument(ui.selectedCommentedDocument);
  // }




  // useEffect(()=>{
  //   console.log("trigger useEffect ui.selectedCommentedDocument:\n", ui.selectedCommentedDocument);
  // },[ui.selectedCommentedDocument]);



  const [tabIndex, setTabIndex] = useState(0);
  const appConfigStore = useAppConfig();
  const problemStore = useProblemStore();
  const context = useUserContext();
  const queryClient = useQueryClient();
  const user = useUserStore();
  const classStore = useClassStore();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const subTabs: ISubTabSpec[] = [];
  // combine sections with matching titles into a single tab with sub-sections
  tabSpec.sections?.forEach(section => {
    const found = subTabs.findIndex(tab => tab.label === section.title);
    if (found >= 0) {
      subTabs[found].sections.push(section);
    }
    else {
      subTabs.push({ label: section.title, sections: [section] });
    }
  });
  const hasSubTabs = subTabs.length > 1;
  const vh = window.innerHeight;
  const headerOffset = hasSubTabs
                        ? kHeaderHeight + (2 * (kWorkspaceContentMargin + kNavTabHeight + kTabSectionBorderWidth))
                        : kHeaderHeight + kNavTabHeight + (2 * (kWorkspaceContentMargin + kTabSectionBorderWidth));
  const documentsPanelHeight = vh - headerOffset;
  const documentsPanelStyle = { height: documentsPanelHeight };
  const sectionClass = referenceDocument?.type === "learningLog" ? "learning-log" : ""; //original
  // const sectionClass = ui.referenceDocument?.type === "learningLog" ? "learning-log" : "";
  const handleTabClick = useCallback((title: string, type?: string) => {
    setReferenceDocument(undefined); //original
    // ui.setReferenceDocument(undefined);
    ui.updateFocusDocument();
    ui.setSelectedTile();
    Logger.log(LogEventName.SHOW_TAB_SECTION, {
      tab_section_name: title,
      tab_section_type: type
    });
  },[ui]);

  useEffect(()=>{
    const selectedSection = tabSpec.tab === "supports" ? ENavTabSectionType.kTeacherSupports : undefined;
    if (selectedSection) {
      const selectedIndex = tabSpec.sections?.findIndex(spec => spec.type === selectedSection);
      if (selectedIndex != null) {
        setTabIndex(selectedIndex);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    if (reset) {
      // setTimeout to avoid infinite render issues
      reset();
      setTimeout(() => handleTabClick(tabSpec.label));
    }
  }, [handleTabClick, reset, tabSpec.label]);

  const handleTabSelect = (tabidx: number) => {
    setTabIndex(tabidx);
    ui.updateFocusDocument();
  };

  const handleSelectDocument = (document: DocumentModelType) => {
    console.log("\n ------ section-document-or-browser.tsx > ---------\n handleSelectDocument with document: \n",
    document);
    // console.log("what is tabSpec.label?: ", tabSpec.label);
    if (!document.hasContent && document.isRemote) {
      loadDocumentContent(document);
    }
    setReferenceDocument(document); //original
    ui.updateFocusDocument();
    setTimeout(()=>{
      // console.log("HERE: referenceDocument:", referenceDocument);
    },1000);

    const logEvent = document.isRemote
      ? LogEventName.VIEW_SHOW_TEACHER_NETWORK_COMPARISON_DOCUMENT
      : LogEventName.VIEW_SHOW_COMPARISON_DOCUMENT;
    Logger.logDocumentEvent(logEvent, document);
  };

  const loadDocumentContent = async (document: DocumentModelType) => {
    await document.fetchRemoteContent(queryClient, context);
  };

  function handleEditClick(document: DocumentModelType) {
    ui.problemWorkspace.setPrimaryDocument(document);
  }

  // if (referenceDocument){
  //   console.log("line 143!!!!");
  //   handleSelectDocument(referenceDocument);
  // }

  // TODO: this edit button is confusing when the history is being viewed. It
  // opens the original document for editing, not some old version of the
  // document they might be looking at. Previously this edit button was disabled
  // when the history document was being shown because SectionDocumentOrBrowser
  // knew the state of playback controls. It no longer knows that state, so now
  // the edit button is shown all of the time.
  // PT Story: https://www.pivotaltracker.com/story/show/183416176
  const editButton = (type: string, sClass: string, document: DocumentModelType) => {
    return (
      (type === "my-work") || (type === "learningLog")
        ?
          <div className={`edit-button ${sClass}`}
                onClick={() => handleEditClick(document)}>
            <EditIcon className={`edit-icon ${sClass}`} />
            <div>Edit</div>
          </div>
        : null
    );
  };

  const handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => {
    e.dataTransfer.setData(DocumentDragKey, document.key);
  };

  const handleDocumentStarClick = (document: DocumentModelType) => {
    document?.toggleUserStar(user.id);
  };

  const handleDocumentDeleteClick = (document: DocumentModelType) => {
    ui.confirm("Do you want to delete this?", "Confirm Delete")
      .then(ok => {
        if (ok) {
          document.setProperty("isDeleted", "true");
          if (document.type === SupportPublication) {
            Logger.logDocumentEvent(LogEventName.DELETE_SUPPORT, document);
          }
        }
      });
  };

  // interface JProps {
  //   selectedCommentedDocument?: DocumentModelType,
  //   subTab: ISubTabSpec,
  // }

  // const renderDocumentBrowserView = observer(({selectedCommentedDocument = ui.selectedCommentedDocument,
  //   subTab: ISubTabSpec}: JProps) => { //added
  const renderDocumentBrowserView = (subTab: ISubTabSpec) => {//original

    // console.log("renderDocumentBrowserView, with subTab:", subTab);
    const classHash = classStore.classHash;
    return (
      <div>
        {
          subTab.sections.map((section: any, index: any) => {
            console.log(`-----------${section.title} index: ${index}-----------`);
            console.log("renderDocumentBrowserView > subTab:", subTab, tabSpec.label);
            console.log("subTab.sections.map:", subTab.sections);
            const _handleDocumentStarClick = section.showStarsForUser(user)
              ? handleDocumentStarClick
              : undefined;
            console.log("**selectedDocument:", selectedDocument);
            console.log("**referenceDocument:", referenceDocument);
            // console.log("ui.selectedCommentedDocument:", ui.selectedCommentedDocument); //return to this
            // if (index === 0){
              // setReferenceDocument(ui.selectedCommentedDocument);
            // }
            return (
              <DocumentCollectionByType
                key={`${section.type}_${index}`}
                topTab={navTabSpec?.tab}
                tab={subTab.label}
                section={section}
                index={index}
                numSections={subTab.sections.length}
                scale={kNavItemScale}
                // selectedDocument={selectedDocument || referenceDocument?.key ||
                //   ui.selectedCommentedDocument?.key}//added
                selectedDocument={selectedDocument || referenceDocument?.key}
                onSelectNewDocument={onSelectNewDocument}
                onSelectDocument={onSelectDocument || handleSelectDocument}
                onDocumentDragStart={handleDocumentDragStart}
                onDocumentStarClick={_handleDocumentStarClick}
                onDocumentDeleteClick={handleDocumentDeleteClick}
              />
            );
          })
        }
        {
          user.isNetworkedTeacher &&
          <NetworkDocumentsSection
            currentClassHash={classHash}
            currentTeacherName={user.name}
            currentTeacherId={user.id}
            subTab={subTab}
            problemTitle={problemStore.title}
            scale={kNavItemScale}
            onSelectDocument={handleSelectDocument}
          />
        }
      </div>
    );
  };

  // });//added

  const showPlayback = user.type ? appConfigStore.enableHistoryRoles.includes(user.type) : false;
  const documentView = referenceDocument && !referenceDocument?.getProperty("isDeleted") && //original
  // const documentView = ui.referenceDocument && !ui.referenceDocument?.getProperty("isDeleted") &&
    <div>
      <div className={`document-header ${tabSpec.tab} ${sectionClass}`} onClick={() => ui.setSelectedTile()}>
        <div className={`document-title`}>
          {getDocumentDisplayTitle(referenceDocument, appConfigStore, problemStore)}
          {/* {getDocumentDisplayTitle(ui.referenceDocument, appConfigStore, problemStore)} */}

        </div>
        {(!referenceDocument.isRemote)
        // {(!ui.referenceDocument.isRemote)
            && editButton(tabSpec.tab, sectionClass,referenceDocument)}
            {/* // && editButton(tabSpec.tab, sectionClass,ui.referenceDocument)} */}
      </div>
      <EditableDocumentContent
        mode={"1-up"}
        isPrimary={false}
        document={referenceDocument} //original
        // document={ui.referenceDocument}
        readOnly={true}
        showPlayback={showPlayback}
      />
    </div>;

  return (
    <div className="document-tab-content">
      <Tabs
        className={`document-tabs ${navTabSpec?.tab} ${isChatOpen ? "chat-open" : ""}`}
        forceRenderTabPanel={true}
        onSelect={handleTabSelect}
        selectedIndex={tabIndex}
        selectedTabClassName="selected"
      >
        <div className={`tab-header-row ${!hasSubTabs ? "no-sub-tabs" : ""}`}>
          <TabList className={`tab-list ${navTabSpec?.tab}`}>
            {subTabs.map((subTab) => {
              const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
              const type = subTab.sections[0].type;
              return (
                <Tab className={`doc-tab ${navTabSpec?.tab} ${sectionTitle} ${type}`}
                  key={`section-${sectionTitle}`}
                  onClick={() => handleTabClick?.(subTab.label, type)}>
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
                { documentView && (index === tabIndex)
                  ? documentView
                  : renderDocumentBrowserView(subTab)
                }
              </TabPanel>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
};
