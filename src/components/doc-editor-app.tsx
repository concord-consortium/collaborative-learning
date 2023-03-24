import React, { useEffect, useRef, useState } from "react";
import { onSnapshot } from "mobx-state-tree";

import { defaultDocumentModel, defaultDocumentModelParts } from "./doc-editor-app-defaults";
import { EditableDocumentContent } from "./document/editable-document-content";
import { createDocumentModel } from "../models/document/document";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { DocumentContentSnapshotType } from "../models/document/document-content";

export type editorModes = "file" | "cmsWidget";
export interface IDocEditorAppProps {
  appConfig: AppConfigModelType;
  contained?: boolean;
  editorMode?: editorModes;
  initialValue?: any;
  onChange?: (value: any) => void;
}
export const DocEditorApp = ({ appConfig, contained, editorMode, initialValue, onChange }: IDocEditorAppProps) => {
  const _editorMode = editorMode ?? "file";
  const [document, setDocument] = useState(() => {
    return createDocumentModel(defaultDocumentModel);
  });
  const [fileHandle, setFileHandle] = useState<FileSystemHandle|undefined>();
  const [sectionSnapshot, setSectionSnapshot] = useState<any>();

  const value = useRef("");
  const [loadedInitialValue, setLoadedInitialValue] = useState(false);

  const updateSectionSnapshot = (_sectionSnapshot: any) => {
    setSectionSnapshot(_sectionSnapshot);
    const documentContentSnapshot = _sectionSnapshot.content as DocumentContentSnapshotType;
    setDocument(createDocumentModel({
      ...defaultDocumentModelParts,
      content: documentContentSnapshot
    }));
  };

  // Load the initial value for widget once
  useEffect(() => {
    if (_editorMode === "cmsWidget" && !loadedInitialValue && initialValue) {
      updateSectionSnapshot({ content: initialValue });
      value.current = JSON.stringify(initialValue);
      setLoadedInitialValue(true);
    }
  }, [_editorMode, loadedInitialValue, initialValue]);

  // Update the widget's value whenever a change is made to the document's content
  useEffect(() => {
    const cleanup = _editorMode === "cmsWidget" && onChange && document.content
      ? onSnapshot(document.content, snapshot => {
          const json = document.content?.exportAsJson();
          if (json) {
            const parsedJson = JSON.parse(json);
            const stringifiedJson = JSON.stringify(parsedJson);
            // Only update when actual changes have been made.
            // This is necessary to avoid fake changes on load.
            if (stringifiedJson !== value.current) {
              onChange(parsedJson);
              value.current = stringifiedJson;
            }
          }
        })
      : undefined;
    return () => cleanup?.();
  }, [document.content, _editorMode, onChange]);

  // The most useful files to edit like this are currently sections
  // so lets work with those
  async function handleOpen() {
    const [_fileHandle] = await (window as any).showOpenFilePicker();
    setFileHandle(_fileHandle);
    const file = await _fileHandle.getFile();
    const text = await file.text();
    const _sectionSnapshot = JSON.parse(text);
    updateSectionSnapshot(_sectionSnapshot);
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
    const docContentString = document.content.exportAsJson();
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
      { _editorMode === "file" && (
        <>
          <button onClick={handleOpen}>open</button>
          <button onClick={handleSave}>save</button>
        </>
      ) }
      <EditableDocumentContent
        contained={contained}
        mode="1-up"
        isPrimary={true}
        readOnly={false}
        document={document}
        toolbar={appConfig.toolbar}
      />
    </>
  );
};
