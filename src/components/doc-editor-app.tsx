import React, { useEffect, useState } from "react";
import stringify from "json-stringify-pretty-compact";
import { getSnapshot } from "mobx-state-tree";

import { defaultDocumentModel, defaultDocumentModelParts } from "./doc-editor-app-defaults";
import { EditableDocumentContent } from "./document/editable-document-content";
import { createDocumentModel } from "../models/document/document";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { DocumentContentSnapshotType } from "../models/document/document-content";
import { urlParams } from "../utilities/url-params";

export interface IDocEditorAppProps {
  appConfig: AppConfigModelType;
}

export const DocEditorApp = ({ appConfig }: IDocEditorAppProps) => {
  const [document, setDocument] = useState(() => {
    return createDocumentModel(defaultDocumentModel);
  });
  const [fileHandle, setFileHandle] = useState<FileSystemHandle|undefined>();
  const [sectionSnapshot, setSectionSnapshot] = useState<any>();
  const [fileName, setFileName] = useState<string>("");

  function loadDocument(text: string) {
    const _parsedText = JSON.parse(text);
    let documentContentSnapshot;
    if (_parsedText.content ) {
      setSectionSnapshot(_parsedText);
      documentContentSnapshot = _parsedText.content as DocumentContentSnapshotType;
    } else {
      documentContentSnapshot = _parsedText;
    }
    setDocument(createDocumentModel({
      ...defaultDocumentModelParts,
      content: documentContentSnapshot
    }));
  }

  // Handle opening both section documents with a content field
  // and basic documents which are just the content itself
  async function handleOpen() {
    const [_fileHandle] = await (window as any).showOpenFilePicker();
    setFileHandle(_fileHandle);
    const file = await _fileHandle.getFile();
    setFileName(file.name);
    const text = await file.text();
    loadDocument(text);
  }

  async function handleSave() {
    if (!document.content) {
      console.error("Can't save without document.content");
      return;
    }

    let _fileHandle = fileHandle;
    if (!_fileHandle) {
      _fileHandle = await (window as any).showSaveFilePicker();
      setFileHandle(_fileHandle);
      if (_fileHandle) {
        const file = await (_fileHandle as any).getFile();
        setFileName(file.name);
      }

    }

    let contents;
    if (sectionSnapshot) {
      // construct the contents of the section
      const docContentString = document.content.exportAsJson({ includeTileIds: true });
      const docContentJSON = JSON.parse(docContentString);
      sectionSnapshot.content = docContentJSON;
      contents = JSON.stringify(sectionSnapshot, undefined, 2);
    } else {
      // TODO: we probably want to keep track if we loaded an exported or raw file
      // and then save it the same way
      const contentJson = getSnapshot(document.content);
      contents = stringify(contentJson, {maxLength: 100});
    }

    const writable = await (_fileHandle as any).createWritable();
    // Write the contents of the file to the stream.
    await writable.write(contents);
    // Close the file and write the contents to disk.
    await writable.close();
  }

  useEffect(() => {
    const {document: documentURL} = urlParams;
    if (!documentURL) {
      return;
    }

    fetch(documentURL)
    .then(async response => {
      if (response.ok) {
        const documentText = await response.text();
        loadDocument(documentText);
      } else {
        // If the document is not found, return the response so that the caller can
        // handle it appropriately.
        throw Error(`Request rejected with status ${response.status}`);
      }
    })
    .catch(error => {
      throw Error(`Request rejected with exception ${error}`);
    });
  }, []);

  return (
    <>
      <button onClick={handleOpen}>open</button>
      <button onClick={handleSave}>save</button>
      <span>{fileName}</span>
      <EditableDocumentContent
        contained={false}
        mode="1-up"
        isPrimary={true}
        readOnly={false}
        document={document}
        toolbar={appConfig.authorToolbar}
      />
    </>
  );
};
