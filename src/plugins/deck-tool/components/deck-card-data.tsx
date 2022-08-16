import React from "react";


interface IProps {
  caseIndex: any;
}
export const DeckCardData: React.FC<IProps> = ({ caseIndex }) => {
  return (
    <div>
      caseIndex: { caseIndex }
    </div>
  );
};


// import React from "react";
// import { IBaseProps } from "../../../app-config";
// import { DeckContentModelType } from "../deck-content"
// import { ToolTileModelType } from "../../../models/tools/tool-tile"


// interface IProps  {
//   caseIndex: number;
//   model: ToolTileModelType;
//   //onSomeEvent: () => void;
// }

// export const DeckCardData: React.FC = ({model, caseIndex}) => {
//   const content = model.content as DeckContentModelType;
//   const thisCase = content.caseByIndex(caseIndex);
//   if (thisCase){
//     const keysHere = Object.keys(thisCase).filter(k => k !== "__id__");
//     const caseData = keysHere.map((k) => {
//       const attrName = content.attrById(k).name;
//       return thisCase ? { a: attrName, v: thisCase[k]} : undefined;
//     });

//     return (
//       caseData.map((theCase, i) => {
//         return (
//           <div className="case-item" key={i}>
//             <div className="attribute"><b>{theCase?.a}</b></div>
//             <div className="value">{theCase?.v}</div>
//           </div>
//         );
//       })
//     );
//   }


//   return (
//     <div className="data-deck-card-data" key="data-area">
//         { children }
//     </div>
//   );
// };

// interface IProps {
//   stamp: StampModelType;
//   isSelected: boolean;
//   onSelectStamp: () => void;
// }
// export const StampButton: React.FC<IProps> = ({ stamp, isSelected, onSelectStamp }) => {
//   return (
//     <div className={classNames("stamp-button", { select: isSelected })} onClick={() => onSelectStamp()}>
//       <img src={stamp.url} draggable="false" />
//       <svg className={`highlight ${isSelected ? "select" : ""}`}
//             xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30">
//         <rect x="1" y="1" width="28" height="28" strokeWidth="2" fill="none"/>
//       </svg>
//     </div>
//   );
// };