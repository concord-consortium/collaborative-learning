import React from "react";
import { INetworkResourceClassResponse } from "../../../functions/src/shared";
import { useNetworkResources } from "../../hooks/network-resources";
import { DocumentModelType } from "../../models/document/document";
import { IStores } from "../../models/stores/stores";
import { CollapsibleDocumentsSection } from "../thumbnail/collapsible-document-section";
import { ISubTabSpec } from "./document-tab-panel";

import "./network-documents-section.scss";

interface IProps {
  currentClassHash: string;
  currentTeacherId: string;
  currentTeacherName: string;
  subTab: ISubTabSpec;
  problemTitle: string;
  stores: IStores;
  scale: number;
  onSelectDocument?: (document: DocumentModelType) => void;
}

export enum NetworkSectionType {
  myClasses = "myClasses",
  myNetwork = "myNetwork",
}

export const NetworkDocumentsSection: React.FC<IProps> = ({ currentClassHash, currentTeacherName,
  currentTeacherId, subTab, problemTitle, stores, scale, onSelectDocument }) => {
  const { data, status } = useNetworkResources();
  const statusMessage = `${status} network data`;

  const myClassesData: INetworkResourceClassResponse[] = [];
  const myNetworkClassesData: INetworkResourceClassResponse[] = [];
  if (data) {
    data.forEach((item) => {
      // skip the current class
      if (item.context_id !== currentClassHash) {
        // if the class belongs to this teacher, add it to the array of myClassesData
        // otherwise add it to the array of myNetworkData
        if (item.teachers?.find((teacher) => teacher.uid === currentTeacherId)) {
          myClassesData.push(item);
        } else {
          myNetworkClassesData.push(item);
        }
      }
    });
  }

  const renderNetworkSection = (networkSectionType: NetworkSectionType, classData: INetworkResourceClassResponse[]) => {
    const sectionName = networkSectionType === NetworkSectionType.myClasses
      ? "My Classes"
      : networkSectionType === NetworkSectionType.myNetwork ? "My Network" : "";
    const sectionClass = networkSectionType === NetworkSectionType.myClasses ? "my-classes" : "";

    return (
      <div className={`network-container ${sectionClass}`}>
        <div className={`network-divider ${sectionClass}`}>
          <div className={`network-divider-label ${sectionClass}`}>{sectionName}</div>
        </div>
        {status !== "success"
          ? <div className={`network-status-label ${sectionClass}`}>{statusMessage}</div>
          : classData?.map((c, index) => {
              const userName = networkSectionType === NetworkSectionType.myClasses
                ? currentTeacherName
                : c.teacher || "unknown teacher";
              const userId = networkSectionType === NetworkSectionType.myClasses
                ? currentTeacherId
                : c.id || "unknown teacher";
              const classHash = networkSectionType === NetworkSectionType.myClasses
                ? currentClassHash
                : c.context_id;
              return <CollapsibleDocumentsSection
                key={index}
                userName={userName}
                userId={userId}
                classNameStr={c.name || "unknown class"}
                classHash={classHash}
                subTab={subTab}
                networkResource={c}
                problemTitle={problemTitle}
                stores={stores}
                scale={scale}
                onSelectDocument={onSelectDocument}
              />;
            })
        }
        <div className={`network-container-spacer ${sectionClass}`} />
      </div>
    );
  };

  return (
    <div>
      {renderNetworkSection(NetworkSectionType.myClasses, myClassesData)}
      {renderNetworkSection(NetworkSectionType.myNetwork, myNetworkClassesData)}
    </div>
  );
};
