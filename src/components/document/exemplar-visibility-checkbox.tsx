import React, { ChangeEvent, useRef } from "react";
import { useLocalDocuments, useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";


interface IProps {
  document: DocumentModelType;
}

export function ExemplarVisibilityCheckbox({ document }: IProps) {
  const documents = useLocalDocuments();
  const { db } = useStores();
  const checkbox = useRef<HTMLInputElement|null>(null);

  if (checkbox.current) {
    // TODO Should we call a method in db that looks up all student shares here?
    // An always-running listener for every exemplar's shares seems heavy handed.
    // Set up a listener only as long as this document is open?
    // Once set:
    //   - if no students have access, unchecked
    //   - if all students have access, checked (where do we get the list of all students?)
    //   - if some do, set indterminate:
    checkbox.current.indeterminate = true;
  }


  const handleShareClick = (e: ChangeEvent<HTMLInputElement>) => {
    // TODO  need to determine what first click does if "indeterminate"
    // Set or remove access for every student.
    console.log("Share clicked", e.target.checked);
  };

  return (
    <div className="document-status">
      <input ref={checkbox} type="checkbox" onChange={handleShareClick} name="share" />
      Share
    </div>
  );
}
