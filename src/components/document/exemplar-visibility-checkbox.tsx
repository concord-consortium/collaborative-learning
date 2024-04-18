import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import { useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";

type ShareState = "pending"|"none"|"some"|"all";

// What state should be set when the user clicks on the checkbox?
const nextState: Record<ShareState,ShareState> = {
  "pending" : "pending",
  "none" : "all",
  "some" : "none", // Unset visibility first, since it does not trigger notifications to students.
  "all" : "none"
};

interface IProps {
  document: DocumentModelType;
}

export function ExemplarVisibilityCheckbox({ document }: IProps) {
  const { db } = useStores();
  const checkbox = useRef<HTMLInputElement|null>(null);
  const [status, setStatus] = useState<ShareState>("pending");

  useEffect(() => {
    db.getExemplarVisibilityForClass(document.key).then((map) => {
      if (Object.values(map).every(v => v)) {
        setStatus("all");
      } else if (Object.values(map).some(v => v)) {
        setStatus("some");
      } else {
        setStatus("none");
      }
    });
  }, [db, document.key]);

  useEffect(() => {
    if (checkbox.current) {
      checkbox.current.disabled = (status === "pending");
      checkbox.current.indeterminate = (status === "some");
      checkbox.current.checked = (status === "all");
    }
  }, [status]);

  const handleShareClick = (e: ChangeEvent<HTMLInputElement>) => {
    // Set or remove access for every student.
    const newState = nextState[status];
    setStatus(newState);
    if (newState === "all" || newState === "none") {
      db.setExemplarVisibilityForAllStudents(document.key, newState==="all");
    }
  };

  return (
    <div className="document-status">
      <input ref={checkbox} type="checkbox" onChange={handleShareClick} name="share" />
      Share
    </div>
  );
}
