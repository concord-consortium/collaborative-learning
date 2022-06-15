import React, { useState } from "react";
import { useUIStore } from "../../hooks/use-stores";
import AddMarkerIcon from "../../clue/assets/icons/playback/add-marker-icon.svg";
import DeleteMarkerIcon from "../../clue/assets/icons/playback/delete-marker-icon.svg";
import CommentMarkerIcon from "../../clue/assets/icons/playback/add-comment-to-marker-icon.svg";

import "./marker-toolbar.scss";

interface IMarkerButtonProps {
  activeNavTab: string;
  disabled: boolean;
}

const AddMarkerButton: React.FC<IMarkerButtonProps> = (props) => {
  const {activeNavTab, disabled} = props;
  return (
    <div>
      <AddMarkerIcon className={`marker-button ${activeNavTab} ${disabled}`}/>
    </div>
  );
};
const DeleteMarkerButton: React.FC<IMarkerButtonProps> = (props) => {
  const {activeNavTab, disabled} = props;
  return (
    <div>
      <DeleteMarkerIcon className={`marker-button  ${activeNavTab} ${disabled}`}/>
    </div>
  );
};
const CommentMarkerButton: React.FC<IMarkerButtonProps> = (props) => {
  const {activeNavTab, disabled} = props;
  return (
    <div>
      <CommentMarkerIcon className={`comment-marker-button  ${activeNavTab} ${disabled}`}/>
    </div>
  );
};


export const PlaybackMarkerToolbar: React.FC = () => {
  const { activeNavTab } = useUIStore();
  const [markerSelected, setMarkerSelected] = useState(false);

  return (
    <div className={`marker-toolbar themed ${activeNavTab}`}>
      <AddMarkerButton activeNavTab={activeNavTab} disabled={markerSelected}/>
      <DeleteMarkerButton activeNavTab={activeNavTab} disabled={!markerSelected}/>
      <CommentMarkerButton activeNavTab={activeNavTab} disabled={!markerSelected}/>
    </div>
  );
};
