import React, { useState } from "react";

import { defaultDocumentModel, defaultDocumentModelParts } from "./doc-editor-app-defaults";
import { EditableDocumentContent } from "./document/editable-document-content";
import { createDocumentModel } from "../models/document/document";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { DocumentContentSnapshotType } from "../models/document/document-content";

export interface IDocEditorAppProps {
  appConfig: AppConfigModelType;
}

export const DocEditorApp = ({ appConfig }: IDocEditorAppProps) => {
  const [document, setDocument] = useState(() => {
    return createDocumentModel(defaultDocumentModel);
  });
  const [fileHandle, setFileHandle] = useState<FileSystemHandle|undefined>();
  const [sectionSnapshot, setSectionSnapshot] = useState<any>();

  // The most useful files to edit like this are currently sections
  // so lets work with those
  async function handleOpen() {
    const [_fileHandle] = await (window as any).showOpenFilePicker();
    setFileHandle(_fileHandle);
    const file = await _fileHandle.getFile();
    const text = await file.text();
    const _sectionSnapshot = JSON.parse(text);
    setSectionSnapshot(_sectionSnapshot);
    const documentContentSnapshot = _sectionSnapshot.content as DocumentContentSnapshotType;
    setDocument(createDocumentModel({
      ...defaultDocumentModelParts,
      content: documentContentSnapshot
    }));
  }

  async function handleSave() {
    if (!fileHandle || !document.content) {
      console.error("Can't save without a fileHandle or document.content");
      return;
    }

    if (!sectionSnapshot) {
      console.error("Currently can't save without a section snapshot");
      return;
    }

    // construct the contents of the section
    const docContentString = document.content.exportAsJson({ includeTileIds: true });
    const docContentJSON = JSON.parse(docContentString);
    sectionSnapshot.content = docContentJSON;
    const contents = JSON.stringify(sectionSnapshot, undefined, 2);

    const writable = await (fileHandle as any).createWritable();
    // Write the contents of the file to the stream.
    await writable.write(contents);
    // Close the file and write the contents to disk.
    await writable.close();
  }

  return (
    <>
      <button onClick={handleOpen}>open</button>
      <button onClick={handleSave}>save</button>
      <EditableDocumentContent
        contained={false}
        mode="1-up"
        isPrimary={true}
        readOnly={false}
        document={document}
        toolbar={appConfig.toolbar}
      />
    </>
  );
};
