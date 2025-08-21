import React, { useState, useEffect, useCallback } from "react";
import { observer } from "mobx-react";
import Markdown from "markdown-to-jsx";
import { useCustomModal } from "../../hooks/use-custom-modal";
import { useDBStore, useStores } from "../../hooks/use-stores";
import { useUserContext } from "../../hooks/use-user-context";
import { useFirebaseFunction } from "../../hooks/use-firebase-function";

import "./summary-button.scss";

interface ISummaryButtonProps {
  className?: string;
}

/**
 * A button that shows a modal with the AI summaries of the student and teacher work.
 * At the moment this is considered internal testing functionality only, so it is only rendered
 * if the `showAiSummary` URL parameter is set to true.
 */
export const SummaryButton: React.FC<ISummaryButtonProps> = observer(function SummaryButton({ className }) {
  const { firestore } = useDBStore();
  const { unit, portal, demo } = useStores();
  const userContext = useUserContext();
  const generateClassData = useFirebaseFunction("generateClassData_v2");

  const regenerateSummaries = useCallback(() => {
    const portalHost = portal.portalHost;
    const demoName = demo.name;
    generateClassData({
      context: userContext,
      portal: portalHost,
      demo: demoName,
      unit: unit.code,
    });
  }, [portal, unit.code, userContext, demo.name, generateClassData]);

  const SummaryContent: React.FC = () => {
    const [studentSummary, setStudentSummary] = useState<string>("");
    const [teacherSummary, setTeacherSummary] = useState<string>("");
    const [contentUpdatedAt, setContentUpdatedAt] = useState<Date | null>(null);
    const [summaryCreatedAt, setSummaryCreatedAt] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const path = firestore.getClassInfoPath(unit.code, userContext.classHash);
      firestore.getDocument(path).then(docSnapshot => {
        const docData = docSnapshot.data();
        if (docData?.studentSummary) {
          setStudentSummary(docData.studentSummary);
        } else {
          setStudentSummary("No student summary available");
        }
        if (docData?.teacherSummary) {
          setTeacherSummary(docData.teacherSummary);
        } else {
          setTeacherSummary("No teacher summary available");
        }
        if (docData?.lastEditedAt) {
          setContentUpdatedAt(new Date(docData.lastEditedAt));
        } else {
          setContentUpdatedAt(null);
        }
        if (docData?.summaryCreatedAt) {
          setSummaryCreatedAt(new Date(docData.summaryCreatedAt.seconds*1000));
        } else {
          setSummaryCreatedAt(null);
        }
        setLoading(false);
      }).catch(error => {
        console.error("Error fetching summary:", error);
        setStudentSummary("Error loading summary");
        setLoading(false);
      });
    }, [firestore, unit.code, userContext]);

    if (loading) {
      return <div>Loading summary...</div>;
    }

    return (
      <div>
        <h3>Teacher work summary</h3>
        <div className="summary-content">
          <Markdown>{teacherSummary}</Markdown>
        </div>
        <h3>Student work summary</h3>
        <div className="summary-content">
          <Markdown>{studentSummary}</Markdown>
        </div>
        <div className="timestamp">
          <p>Summary created at: {summaryCreatedAt?.toLocaleString("en-US", {dateStyle: "long", timeStyle: "short"})}</p>
          <p>Latest user content included: {contentUpdatedAt?.toLocaleString("en-US", {dateStyle: "long", timeStyle: "short"})}</p>
        </div>
      </div>
    );
  };

  const [showModal, hideModal] = useCustomModal({
    className: "summary-modal scrollable-modal",
    title: "AI Summaries of Class Work",
    Content: SummaryContent,
    contentProps: {},
    buttons: [
      { label: "Regenerate summaries", isDefault: false, onClick: regenerateSummaries }
    ],
    canCancel: true
  });

  const handleSummaryClick = () => {
    showModal();
  };

  return (
    <button onClick={handleSummaryClick} className={`summary-button ${className || ""}`}>
      Summary
    </button>
  );
});
