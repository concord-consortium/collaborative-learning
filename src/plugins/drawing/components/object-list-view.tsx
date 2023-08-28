import React, { useState } from "react"



export function ObjectListView() {

  const [open, setOpen] = useState(false);

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  if (open) {
    return (
    <div className="object-list open">
      <div className="header">
        <h4>Show/Sort</h4>
        <button type="button" className="close" onClick={handleClose} aria-label="Close show/sort panel">&lt;</button>
      </div>
      <p>List of objects goes here</p>
    </div>);

  } else {
    return (
    <div className="object-list closed">
      <button type="button" onClick={handleOpen} aria-label="Open show/sort panel">&gt;</button>
    </div>);
  }

}