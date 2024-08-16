import React, { useEffect, useState } from "react";

import { useFirestore } from "../../hooks/firestore-hooks";
import { useStores, usePersistentUIStore, useUserStore, useUIStore} from "../../hooks/use-stores";
import { useDocumentCaption } from "../../hooks/use-document-caption";
import { UserModelType } from "../../models/stores/user";
import { getNavTabOfDocument, getTabsOfCurriculumDoc, isStudentWorkspaceDoc } from "../../models/stores/persistent-ui";
import { DocumentModelType } from "../../models/document/document";
import { CommentedDocumentsQuery, CurriculumDocumentInfo, StudentDocumentInfo } from "../../models/commented-documents";

import DocumentIcon from "../../assets/icons/document-icon.svg";

import "./commented-documents.scss";

interface IProps {
  user?: UserModelType
  handleDocView: (() => void) | undefined;
}

export const CommentedDocuments: React.FC<IProps> = ({user, handleDocView}) => {
  const [db] = useFirestore();
  const ui = useUIStore();
  const persistentUI = usePersistentUIStore();
  const store = useStores();
  const problem =  store.problemOrdinal;
  const unit = store.unit.code;

  const [commentedDocumentsQuery, setCommentedDocumentsQuery] = useState<CommentedDocumentsQuery>();
  const [curricumDocs, setCurricumDocs] = useState<CurriculumDocumentInfo[]>([]);
  const [studentDocs, setStudentDocs] = useState<StudentDocumentInfo[]>([]);


  useEffect(() => {
    if (user) {
      setCommentedDocumentsQuery(new CommentedDocumentsQuery(db, user, unit, problem));
    }
  }, [user, db, unit, problem]);

  useEffect(() => {
    commentedDocumentsQuery?.queryCurriculumDocs().then(() => {
      setCurricumDocs(commentedDocumentsQuery.getCurricumDocs());
    });
    commentedDocumentsQuery?.queryStudentDocs().then(() => {
      setStudentDocs(commentedDocumentsQuery.getStudentDocs());
    });
  }, [commentedDocumentsQuery]);

  return (
    <div className="commented-document-list">
      {
        (curricumDocs).map((doc, index) => {
          const {navTab} = getTabsOfCurriculumDoc(doc.path);
          return (
            <div
              className={`document-box ${navTab}`}
              key={index}
              onClick={() => {
                persistentUI.openCurriculumDocument(doc.path);
                ui.setSelectedTile();
                if (handleDocView !== undefined){
                  handleDocView();
                }
              }}
            >
              <div className="document-type-icon">
                <DocumentIcon/>
              </div>
              <div className={"title"}>
                { doc.unit.toUpperCase() + " " + doc.problem + " " + doc.title}
              </div>
              <div className={"numComments"}>
                {doc.numComments}
              </div>
            </div>
          );
        })
      }
      {
        (studentDocs).map((doc, index) =>{
          const sectionDoc =  store.documents.getDocument(doc.key);
          const networkDoc = store.networkDocuments.getDocument(doc.key);
          if (sectionDoc){
            return (
              <WorkDocumentItem
                key={index}
                doc={doc}
                sectionOrNetworkDoc={sectionDoc}
                isNetworkDoc={false}
                handleDocView={handleDocView}
              />
            );
          }
          if (networkDoc){
            return (
              <WorkDocumentItem
                key={index}
                doc={doc}
                sectionOrNetworkDoc={networkDoc}
                isNetworkDoc={true}
                handleDocView={handleDocView}
              />
            );
          }
        })
      }
    </div>
  );
};


interface JProps {
  doc: any,
  sectionOrNetworkDoc: DocumentModelType,
  isNetworkDoc: boolean,
  handleDocView: (() => void) | undefined,
}

// This is rendering a single document item in the commented document list
export const WorkDocumentItem: React.FC<JProps> = (props) => {
  const { doc, sectionOrNetworkDoc, isNetworkDoc, handleDocView } = props;
  const ui = useUIStore();
  const persistentUI = usePersistentUIStore();
  const user = useUserStore();
  // We need the navTab to style the item.
  const navTab = getNavTabOfDocument(doc, user);
  const title =  useDocumentCaption(sectionOrNetworkDoc, isStudentWorkspaceDoc(sectionOrNetworkDoc, user.id));

  return (
    <div
      className={`document-box my-work-document ${navTab}`}
      onClick={()=>{
        persistentUI.openResourceDocument(sectionOrNetworkDoc, user);
        ui.setSelectedTile();
        if (handleDocView !== undefined){
          handleDocView();
        }
      }}
    >
    {
      isNetworkDoc ?
        <div className="document-type-icon-yellow">
          <DocumentIcon/>
          <div className="yellow-background"/>
        </div>
        :
        <div className="document-type-icon">
          <DocumentIcon/>
        </div>
    }
      <div className={"title"}>
        { title }
      </div>
      <div className={"numComments"}>
        {doc.numComments}
      </div>
    </div>
  );
};
