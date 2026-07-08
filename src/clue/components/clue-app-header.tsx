import { ToggleGroup } from "@concord-consortium/react-components";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { EPanelId, IPanelGroupSpec } from "../../components/app-header";
import { IBaseProps } from "../../components/base";
import { ChatTutorSidebar } from "../../components/chat-tutor/chat-sidebar";
import { ClassMenuContainer } from "../../components/class-menu-container";
import { GroupManagementModal } from "../../components/group/group-management-modal";
import { NetworkStatus } from "../../components/network-status";
import { ProblemMenuContainer } from "../../components/problem-menu-container";
import { StudentMenuContainer } from "../../components/student-menu-container";
import { useClueAccessibility } from "../../hooks/use-clue-accessibility";
import { useStores } from "../../hooks/use-stores";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { GroupModelType, GroupUserModelType } from "../../models/stores/groups";
import { upperWords } from "../../utilities/string-utils";
import { translate } from "../../utilities/translation/translate";
import { urlParams } from "../../utilities/url-params";
import AppModeIndicator from "./app-mode-indicator";
import { CustomSelect } from "./custom-select";

// cf. https://mattferderer.com/use-sass-variables-in-typescript-and-javascript
import styles from "./toggle-buttons.scss";

import "./clue-app-header.scss";

interface IProps extends IBaseProps {
  panels: IPanelGroupSpec;
  current: string;
  onPanelChange: (panelId: EPanelId) => void;
  showGroup: boolean;
}

export const ClueAppHeaderComponent: React.FC<IProps> = observer(function ClueAppHeaderComponent(props) {
  const { showGroup } = props;
  const {
    appConfig, appMode, appVersion, db, user, groups, investigation, ui, unit, problem,
    persistentUI, documents, problemPath
  } = useStores();
  const myGroup = showGroup ? groups.getGroupById(user.currentGroupId) : undefined;
  const [isGroupManagementModalOpen, setIsGroupManagementModalOpen] = useState(false);
  const [isStudentGroupModalOpen, setIsStudentGroupModalOpen] = useState(false);
  const [isChatTutorOpen, setIsChatTutorOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const chatTutorLauncherRef = useRef<HTMLButtonElement>(null);

  // Read during render (the header is an observer) so the launcher appears/disappears
  // and the conversation re-keys when the student switches or closes documents. The
  // gate requires loaded content, not just a restored key: DocumentModel.content is
  // types.maybe and the workspace summarizer throws on undefined content.
  const chatTutorDocumentKey = persistentUI.problemWorkspace.primaryDocumentKey;
  const chatTutorDocument = chatTutorDocumentKey ? documents.getDocument(chatTutorDocumentKey) : undefined;
  const showChatTutorLauncher =
    !!urlParams.chatTutor && user.isStudent && !!chatTutorDocumentKey && !!chatTutorDocument?.content;

  const handleCloseChatTutor = useCallback(() => {
    setIsChatTutorOpen(false);
    chatTutorLauncherRef.current?.focus();
  }, []);

  // Don't leave the drawer flagged open after its document goes away, or it would
  // pop back open unrequested when a document loads again.
  useEffect(() => {
    if (!showChatTutorLauncher) {
      setIsChatTutorOpen(false);
    }
  }, [showChatTutorLauncher]);

  useClueAccessibility({
    type: "region",
    navigation: {
      containerRef: headerRef,
      itemSelector: "button, .custom-select .header[role='button']",
      orientation: "horizontal",
    },
  });

  const handleOpenGroupManagementModal = useCallback(() => {
    setIsGroupManagementModalOpen(true);
  }, []);

  const handleCloseGroupManagementModal = useCallback(() => {
    setIsGroupManagementModalOpen(false);
  }, []);

  const handleOpenStudentGroupModal = useCallback(() => {
    setIsStudentGroupModalOpen(true);
  }, []);

  const handleCloseStudentGroupModal = useCallback(() => {
    setIsStudentGroupModalOpen(false);
  }, []);

  const handleSaveGroupChanges = useCallback(async (moves: Map<string, string | null>) => {
    for (const [studentId, targetGroupId] of moves) {
      await db.moveStudentToGroup(studentId, targetGroupId);
    }
  }, [db]);

  const getUserTitle = () => {
    switch(appMode){
      case "dev":
      case "qa":
      case "test":
        return `Firebase UID: ${db.firebase.userId}`;
      default:
        return undefined;
    }
  };

  const renderPanelButtons = () => {
    const { panels, onPanelChange, current} = props;
    if (!panels || (panels.length < 2)) return;

    const panelButtons = panels
      .filter(spec => spec.label.length > 0)
      .map(spec => {
        const { label, panelId } = spec;
        const onClick = () => { onPanelChange?.(panelId); };
        const key = panelId;
        const selected = key === current;
        const colors = panelId === EPanelId.workspace || panelId === EPanelId.dashboard
          ? {
            unselectedColor: {
              color: panelId === EPanelId.workspace
                     ? styles.toggleButtonWorkspaceColor
                     : styles.toggleButtonDashboardColor,
              background: panelId === EPanelId.workspace
                          ? styles.toggleButtonWorkspaceBackgroundColor
                          : styles.toggleButtonDashboardBackgroundColor
            },
            hoverColor: {
              color: panelId === EPanelId.workspace
                     ? styles.toggleButtonWorkspaceColor
                     : styles.toggleButtonDashboardColor,
              background: panelId === EPanelId.workspace
                          ? styles.toggleButtonWorkspaceHoverBackgroundColor
                          : styles.toggleButtonDashboardHoverBackgroundColor
            },
            selectedColor: {
              color: panelId === EPanelId.workspace
                     ? styles.toggleButtonWorkspaceColor
                     : styles.toggleButtonDashboardColor,
              background: panelId === EPanelId.workspace
                          ? styles.toggleButtonWorkspaceSelectedBackgroundColor
                          : styles.toggleButtonDashboardSelectedBackgroundColor,
            }
          }
          : undefined;
        return { label, onClick, key, selected, colors };
      });
    return <ToggleGroup options={panelButtons} />;
  };

  const renderGroup = (group: GroupModelType) => {
    const groupUsers = group.activeUsers.slice();
    const userIndex = groupUsers.findIndex((groupUser) => groupUser.id === user.id);
    // Put the main user first to match 4-up colors
    if (userIndex > -1) {
      groupUsers.unshift(groupUsers.splice(userIndex, 1)[0]);
    }
    const groupLabel = `${upperWords(translate("studentGroup"))} ${group.id}`;
    return (
      <button type="button" onClick={handleOpenStudentGroupModal} className="group" aria-label={groupLabel}>
        <div className="name" data-test="group-name">{groupLabel}</div>
        <div className="group-center"/>
        <div className="members" data-test="group-members">
          <div className="row">
            {renderGroupUser(groupUsers, 0, "nw")}
            {renderGroupUser(groupUsers, 1, "ne")}
          </div>
          <div className="row">
            {renderGroupUser(groupUsers, 3, "sw")}
            {renderGroupUser(groupUsers, 2, "se")}
          </div>
        </div>
      </button>
    );
  };

  const renderGroupUser = (groupUsers: GroupUserModelType[], index: number, direction: "nw" | "ne" | "se" | "sw") => {
    if (groupUsers.length <= index) {
      return (
        <div key={`empty-${index}`} className={`member empty ${direction}`}/>
      );
    }

    const groupUser = groupUsers[index];
    const memberClass = `member ${groupUser.connected ? "connected" : "disconnected"}`;
    const memberLabel = `${groupUser.name}: ${groupUser.connected ? "connected" : "disconnected"}`;
    return (
      <div
        key={groupUser.id}
        className={`${memberClass} ${direction}`}
        role="img"
        aria-label={memberLabel}
        title={memberLabel}
      >
        <div className="initials">{groupUser.initials}</div>
      </div>
    );
  };

  const renderStudentGroupsButton = () => {
    const buttonClass = `student-groups-button${isGroupManagementModalOpen ? " selected" : ""}`;
    return (
      <button
        type="button"
        className={buttonClass}
        aria-pressed={isGroupManagementModalOpen}
        onClick={handleOpenGroupManagementModal}
      >
        <div className="student-groups-label">
          <span className="student-groups-text">Student</span>
          <span className="student-groups-text">Groups</span>
        </div>
        <div className="student-groups-icon">
          <div className="student-groups-row">
            <div className="student-icon" />
            <div className="student-icon" />
          </div>
          <div className="student-groups-row">
            <div className="student-icon" />
            <div className="student-icon" />
          </div>
        </div>
      </button>
    );
  };

  const renderChatTutorLauncher = () => {
    if (!showChatTutorLauncher) return null;
    return (
      <button
        type="button"
        ref={chatTutorLauncherRef}
        className="chat-tutor-launcher"
        aria-expanded={isChatTutorOpen}
        aria-controls="chat-tutor-sidebar"
        onClick={() => setIsChatTutorOpen(open => !open)}
        data-testid="chat-tutor-launcher"
      >
        <span className="chat-tutor-launcher-icon" aria-hidden="true">💬</span>
        <span>Tutor</span>
      </button>
    );
  };

  const renderChatTutorSidebar = () => {
    if (!isChatTutorOpen || !showChatTutorLauncher || !chatTutorDocumentKey || !chatTutorDocument?.content) {
      return null;
    }
    return (
      <ChatTutorSidebar
        documentKey={chatTutorDocumentKey}
        documentTitle={getDocumentDisplayTitle(unit, chatTutorDocument, appConfig) || problem.title}
        problemPath={problemPath}
        problem={problem}
        content={chatTutorDocument.content}
        onClose={handleCloseChatTutor}
      />
    );
  };

  const renderNonStudentHeader = ({showProblemMenu}: {showProblemMenu: boolean}) => {
    return (
      <header ref={headerRef} className="app-header" aria-label="CLUE Header">
        <div className="left">
          <div className="unit" data-test="investigation-title">
            <div className="title">
              {unit.title}
            </div>
            <div className="investigation">
              {investigation.title}
            </div>
          </div>
          {showProblemMenu &&
          <>
            <div className="separator"/>
            <div className="problem-dropdown" data-test="problem-dropdown">
              <ProblemMenuContainer />
            </div>
          </>
          }
        </div>
        <div className="middle">
          {renderPanelButtons()}
        </div>
        <div className="right">
          <div className="version">CLUE v{appVersion}</div>
          {renderStudentGroupsButton()}
          <div className="user teacher" title={getUserTitle()}>
            <div className="class" data-test="user-class">
              <ClassMenuContainer />
            </div>
            <div className="profile-icon teacher">
              <div className="profile-icon-inner"/>
            </div>
          </div>
          <GroupManagementModal
            isOpen={isGroupManagementModalOpen}
            mode="teacher"
            onClose={handleCloseGroupManagementModal}
            onSave={handleSaveGroupChanges}
          />
        </div>
      </header>
    );
  };

  const renderProblemInfo = () => {
    // Only show the problem menu if the user is in standalone mode as we currently
    // only support switching in standalone for students.  Teachers should already
    // see the class switcher via the renderNonStudentHeader function unless the
    // showClassSwitcher flag is set to false in which case they will get here
    // as the default case (in which case we still don't show the problem menu since
    // the flag is still false).
    if ((ui.standalone || user.standaloneAuthUser) && appConfig.showClassSwitcher) {
      return (
        <div className="problem-dropdown" data-test="user-problem">
          <ProblemMenuContainer />
        </div>
      );
    }

    return (
      <CustomSelect
        items={[{text: `${problem.title}${problem.subtitle ? `: ${problem.subtitle}`: ""}`}]}
        isDisabled={true}
      />
    );
  };

  if (user.isResearcher) {
    return renderNonStudentHeader({showProblemMenu: false});
  }

  if (user.isTeacher && appConfig.showClassSwitcher) {
    return renderNonStudentHeader({showProblemMenu: true});
  }

  const showUserInfo = !(ui.standalone && user.standaloneAuth);
  const showAppMode = showUserInfo;
  const showGroupInfo = showUserInfo;
  const showUnitInfo = unit.title !== "Null Unit";

  return (
    <>
      <header ref={headerRef} className="app-header" aria-label="CLUE Header">
        <div className="left">
          {showUnitInfo &&
          <>
            <div className="unit">
              <div className="title" data-test="unit-title">
                {unit.title}
              </div>
              <div className="investigation" data-test="investigation">
                {investigation.title}
              </div>
            </div>
            <div className="separator"/>
          </>
          }
          {renderProblemInfo()}
        </div>
        <div className="middle student">
          {renderPanelButtons()}
        </div>
        <div className="right">
          {renderChatTutorLauncher()}
          {showAppMode && <AppModeIndicator appMode={appMode}/>}
          <div className="network-status-and-version">
            <NetworkStatus user={user}/>
            <div className="version">CLUE v{appVersion}</div>
          </div>
          {showGroupInfo && myGroup ? renderGroup(myGroup) : null}
          {showUserInfo &&
          <div className="user" title={getUserTitle()}>
            <div className="user-contents">
              <StudentMenuContainer />
            </div>
            <div className="profile-icon">
              <div className="profile-icon-inner"/>
            </div>
          </div>
          }
          <GroupManagementModal
            isOpen={isStudentGroupModalOpen}
            mode="student"
            onClose={handleCloseStudentGroupModal}
          />
        </div>
      </header>
      {renderChatTutorSidebar()}
    </>
  );
});
