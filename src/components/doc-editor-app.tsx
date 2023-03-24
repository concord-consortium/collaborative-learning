import React, { useEffect, useState } from "react";
import { SectionModel } from "../models/curriculum/section";
import { createDocumentModel } from "../models/document/document";
import { ProblemDocument } from "../models/document/document-types";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { EditableDocumentContent } from "./document/editable-document-content";

type editorModes = "file" | "json";
interface IProps {
  appConfig: AppConfigModelType;
  contained?: boolean;
  editorMode?: editorModes;
  initialValue?: any;
}
export const DocEditorApp = ({ appConfig, contained, editorMode, initialValue }: IProps) => {
  const _editorMode = editorMode ?? "file";
  const [document, setDocument] = useState(() => {
    const rowId = "row1";
    const tileId = "tile1";
    return createDocumentModel({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      createdAt: 1,
      visibility: "public",
      content: {
        rowMap: {
          [rowId]: {
            id: rowId,
            tiles: [{ tileId }]
          }
        },
        rowOrder: [
          rowId
        ],
        tileMap: {
          [tileId]: {
            id: tileId,
            content: {
              type: "Text",
              text: "Welcome to the standalone document editor"
            }
          }
        }
      }
    });
  });
  const [fileHandle, setFileHandle] = useState<FileSystemHandle|undefined>();
  const [sectionSnapshot, setSectionSnapshot] = useState<any>();

  const [loadedInitialValue, setLoadedInitialValue] = useState(false);

  const updateSectionSnapshot = (_sectionSnapshot: any) => {
    setSectionSnapshot(_sectionSnapshot);
    const documentContentSnapshot = _sectionSnapshot.content;
    setDocument(createDocumentModel({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      createdAt: 1,
      visibility: "public",
      content: documentContentSnapshot
    }));
  };

  useEffect(() => {
    if (_editorMode === "json" && !loadedInitialValue && initialValue) {
      console.log(`setting initial value`, initialValue);
      updateSectionSnapshot(initialValue);
      setLoadedInitialValue(true);
    }
  }, [_editorMode, loadedInitialValue, initialValue]);

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
