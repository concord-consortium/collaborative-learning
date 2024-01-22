import React from "react";
import { DocumentModelType } from "../../models/document/document";

import "./doc-list-debug.scss";

interface IProps {
  docs: DocumentModelType[];
}

export function DocListDebug(props: IProps) {
  const { docs } = props;
  return (
    <table className="doc-list-debug">
      <thead>
        <tr>
          <th>ct</th>
          <th>key</th>
          <th>type</th>
          <th>viz</th>
          <th>uid</th>
          <th>gp</th>
          <th>title</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((doc, idx) => {
          const ct = idx + 1;
          return (
            <tr key={idx}>
              <td>{ct}</td>
              <td>{doc.key}</td>
              <td>{doc.type}</td>
              <td>{doc.visibility ? doc.visibility : "undefined"}</td>
              <td>{doc.uid}</td>
              <td>{doc.groupId ?? " "}</td>
              <td>{doc.title}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
