import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useCustomModal } from "../../hooks/use-custom-modal";
import { useDBStore, useStores } from "../../hooks/use-stores";
import { useUserContext } from "../../hooks/use-user-context";

import "./summary-button.scss";

interface ISummaryButtonProps {
  className?: string;
}

// Simple markdown to HTML converter for basic markdown syntax
// TODO: use a markdown library instead
function markdownToHtml(markdown: string): string {
  if (!markdown) return "";

  return markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Line breaks
    .replace(/\n/g, '<br>')
    // Lists
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    // Blockquotes
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
}

/**
 * A button that shows a modal with the AI summaries of the student and teacher work.
 * At the moment this is considered internal testing functionality only, so it is only rendered
 * on non-production urls.
 */
export const SummaryButton: React.FC<ISummaryButtonProps> = observer(function SummaryButton({ className }) {
  const { firestore } = useDBStore();
  const { unit } = useStores();
  const { classHash } = useUserContext();

  const SummaryContent: React.FC = () => {
    const [studentSummary, setStudentSummary] = useState<string>("");
    const [teacherSummary, setTeacherSummary] = useState<string>("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const path = firestore.getClassInfoPath(unit.code, classHash);
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
        setLoading(false);
      }).catch(error => {
        console.error("Error fetching summary:", error);
        setStudentSummary("Error loading summary");
        setLoading(false);
      });
    }, [firestore, unit.code, classHash]);

    if (loading) {
      return <div>Loading summary...</div>;
    }

    return (
      <div>
        <h3>Teacher work summary</h3>
        <div
          className="summary-content"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(teacherSummary) }}
        />
        <h3>Student work summary</h3>
        <div
          className="summary-content"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(studentSummary) }}
        />
      </div>
    );
  };

  const [showModal, hideModal] = useCustomModal({
    className: "summary-modal scrollable-modal",
    title: "AI Summaries of Class Work",
    Content: SummaryContent,
    contentProps: {},
    buttons: [
      { label: "Close", isDefault: true, onClick: () => hideModal() }
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
