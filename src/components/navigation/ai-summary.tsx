import React, { useCallback, useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import Markdown from "markdown-to-jsx";

import { useDBStore, useStores } from "../../hooks/use-stores";
import { useFirebaseFunction } from "../../hooks/use-firebase-function";
import { useUserContext } from "../../hooks/use-user-context";

import ArrowIcon from "../../assets/icons/arrow/arrow.svg";

import "./ai-summary.scss";

interface CreatedAt {
  seconds: number;
  nanoseconds: number;
}

interface PartialSummaryDataResult {
  studentSummary: string;
  teacherSummary: string;
  lastEditedAt: number;
  summaryCreatedAt: CreatedAt;
}
interface SummaryData {
  studentSummary?: string;
  teacherSummary?: string;
  lastEditedAt?: string;
  summaryCreatedAt?: string;
}

type Status = "checking" | "generating" | "regenerating" | "error" | "loaded";

const statusMessages: Record<Status, string> = {
  checking: "Checking for summary...",
  generating: "Generating summary...",
  regenerating: "Regenerating summary...",
  error: "Error loading summary",
  loaded: "",
};

const niceDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString("en-US", {
    dateStyle: "long", timeStyle: "short"
  });
};

const AISummaryContent: React.FC = () => {
  const { firestore } = useDBStore();
  const { unit, portal, demo } = useStores();
  const userContext = useUserContext();
  const generateClassData = useFirebaseFunction("generateClassData_v2");
  const [summaryData, setSummaryData] = useState<SummaryData>({});
  const [status, setStatus] = useState<Status>("checking");
  const lastSummaryCreatedAtRef = useRef<CreatedAt|undefined>();

  const summarize = useCallback(() => {
    const portalHost = portal.portalHost;
    const demoName = demo.name;
    generateClassData({
      context: userContext,
      portal: portalHost,
      demo: demoName,
      unit: unit.code,
    });
  }, [portal, unit.code, userContext, demo.name, generateClassData]);

  const handleSummarizeAgain = useCallback(() => {
    setStatus("regenerating");
    summarize();
  }, [setStatus, summarize]);

  useEffect(() => {
    const path = firestore.getClassInfoPath(unit.code, userContext.classHash);
    const unsubscribe = firestore.documentRef(path).onSnapshot((docSnapshot) => {
      const result = (docSnapshot.data() ?? {}) as PartialSummaryDataResult;

      // no summary created or regenerated yet?
      if (!result.summaryCreatedAt || (lastSummaryCreatedAtRef.current &&
          result.summaryCreatedAt.seconds === lastSummaryCreatedAtRef.current.seconds &&
          result.summaryCreatedAt.nanoseconds === lastSummaryCreatedAtRef.current.nanoseconds)) {
        // if this is the initial load, trigger a summary generation
        if (status === "checking") {
          setStatus("generating");
          summarize();
        }
        // wait for the summary to be created/regenerated
        return;
      }
      lastSummaryCreatedAtRef.current = result.summaryCreatedAt;

      setSummaryData({
        studentSummary: result.studentSummary,
        teacherSummary: result.teacherSummary,
        lastEditedAt: result.lastEditedAt ? niceDate(result.lastEditedAt) : undefined,
        summaryCreatedAt: result.summaryCreatedAt ? niceDate(result.summaryCreatedAt.seconds*1000) : undefined
      });
      setStatus("loaded");
    }, (error) => {
      console.error("Error fetching summary:", error);
      setSummaryData({});
      setStatus("error");
    });
    return () => unsubscribe();
  }, [status, setStatus, setSummaryData, firestore, unit.code, userContext.classHash, summarize]);

  if (status !== "loaded") {
    return (
      <div className="ai-summary-content">
        {statusMessages[status]}
      </div>
    );
  }

  return (
    <div className="ai-summary-content">
      <h3>Teacher work summary</h3>
      <div className="summary-content">
        <Markdown>{summaryData.teacherSummary ?? "No teacher summary available"}</Markdown>
      </div>

      <h3>Student work summary</h3>
      <div className="summary-content">
        <Markdown>{summaryData.studentSummary ?? "No student summary available" }</Markdown>
      </div>

      {summaryData.summaryCreatedAt || summaryData.lastEditedAt ? (
        <div className="timestamp">
          <div>
            Summary created at: {summaryData.summaryCreatedAt ?? "N/A"}
          </div>
          <div>
            Latest user content included: {summaryData.lastEditedAt ?? "N/A"}
          </div>
        </div>
      ) : null}

      <div className="bottom-buttons">
        <button onClick={handleSummarizeAgain}>Summarize Again</button>
      </div>
    </div>
  );
};

export const AiSummary: React.FC = observer(function AiSummary(){
  const { user } = useStores();
  const [showSummary, setShowSummary] = useState(false);

  // only show for teacher and researchers
  if (!user.isTeacherOrResearcher) {
    return null;
  }

  return (
    <div className="ai-summary">
      <div className="ai-summary-header">
        <div className="ai-summary-header-title">
          Class Summary
        </div>
        <div className="ai-summary-header-toggle">
          <ArrowIcon
            className={classNames("ai-summary-header-toggle-arrow", {up: showSummary})}
            onClick={() => setShowSummary(!showSummary)}
          />
        </div>
      </div>
      {showSummary && <AISummaryContent />}
    </div>
  );
});
