import React from "react";
import classNames from "classnames";
import { useUIStore } from "../../hooks/use-stores";
import { IMarkerProps } from "./playback-control";
import AddMarkerIcon from "../../clue/assets/icons/playback/add-marker-icon.svg";
import DeleteMarkerIcon from "../../clue/assets/icons/playback/delete-marker-icon.svg";
// import CommentMarkerIcon from "../../clue/assets/icons/playback/add-comment-to-marker-icon.svg";

import "./marker-toolbar.scss";

interface IProps {
  selectedMarkers: IMarkerProps[];
  markerSelected: boolean;
  addMarkerSelected: boolean;
  onMarkerSelected?: (selected: boolean) => void;
  onAddMarkerSelected: (selected: boolean) => void;
}

// TODO: when user clicks on Add Marker, it stays in selected state
//       By default, add marker is enabled,
// TODO: Need to handle delete marker. Currently, we don't track which marker was selected, so we don't delete any
// TODO: need to handle comment marker.
// TODO: need to add editable marker labels.
export const PlaybackMarkerToolbar: React.FC<IProps> = ({ markerSelected, addMarkerSelected, onAddMarkerSelected }) => {
  const { activeNavTab } = useUIStore();

  const AddMarkerButton: React.FC = () => {
    const handleAddMarker = () => {
      onAddMarkerSelected(!addMarkerSelected);
    };
    const markerButtonClass = classNames("add-marker-button", activeNavTab, { "disabled" : markerSelected },
                                         { "selected": addMarkerSelected });
    return (
      <div className={markerButtonClass}
        onClick={handleAddMarker}>
        <AddMarkerIcon />
      </div>
    );
  };
  const DeleteMarkerButton: React.FC = () => {
    const handleDeleteMarker = () => {
      //TODO handle deleting markers
    };

    return (
      <div className={`delete-marker-button ${activeNavTab} ${!markerSelected ?  "disabled" : ""}`}
            onClick={handleDeleteMarker}>
        <DeleteMarkerIcon />
      </div>
    );
  };
  // const CommentMarkerButton: React.FC = () => {
  //   const handleAddCommentToMarker = () => {
  //     //TODO handle commenting on markers
  //   };

  //   return (
  //     <div className={`comment-marker-button  ${activeNavTab} ${!markerSelected ?  "disabled" : ""}`}
  //           onClick={handleAddCommentToMarker}>
  //       <CommentMarkerIcon />
  //     </div>
  //   );
  // };

  return (
    <div className={`marker-toolbar ${activeNavTab}`}>
      <AddMarkerButton />
      <DeleteMarkerButton />
      {/* <CommentMarkerButton /> */}
    </div>
  );
};
