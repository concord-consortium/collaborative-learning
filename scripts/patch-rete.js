/*
 * This script pre-processes the Rete module code to install simple code patches.
 * We tried forking the Rete repository, making the changes there and then publishing
 * the fork, but there are complicated dependencies with some of the other plugins
 * (notably the rete-connection-plugin) that made it difficult to get the published
 * forks working correctly with Dataflow. With this alternate approach, we process
 * the Rete code before it is bundled by Webpack.
 */
module.exports = function patchRete(retePath) {
  const fs = require('fs');
  const retePre = fs.readFileSync(retePath, { encoding: 'utf8' });

  /*
   * The Zoom patch limits scroll-wheel zooming to when the mouse is over the
   * white space of the Rete editor, i.e. not when over a node or other content
   * that might want to handle the wheel event themselves. When the Zoom code
   * swallows the wheel event, it prevents node menus from scrolling, etc.
   */
  const preZoomPatchSrc = [
    `  _createClass(Zoom, [{`,
    `    key: "wheel",`,
    `    value: function wheel(e) {`,
    `      e.preventDefault();`
  ];
  const preZoomPatchStr = preZoomPatchSrc.join("\n");

  const postZoomPatchSrc = [
    `  _createClass(Zoom, [{`,
    `    key: "wheel",`,
    `    value: function wheel(e) {`,
    `      if (e.currentTarget !== e.target) return;`,
    `      e.preventDefault();`
  ];
  const postZoomPatchStr = postZoomPatchSrc.join("\n");
  let retePost = retePre.replace(preZoomPatchStr, postZoomPatchStr);
  const hasZoomPatch = retePost.indexOf(postZoomPatchStr) >= 0;

  /*
   * The Drag patch limits dragging to the primary mouse button, to prevent
   * nodes from getting stuck to the mouse after right-button clicks.
   */
  const preDragPatchSrc = [
    `  _createClass(Drag, [{`,
    `    key: "down",`,
    `    value: function down(e) {`,
    `      e.stopPropagation();`
  ];
  const preDragPatchStr = preDragPatchSrc.join("\n");

  const postDragPatchSrc = [
    `  _createClass(Drag, [{`,
    `    key: "down",`,
    `    value: function down(e) {`,
    `      if (e.pointerType === 'mouse' && e.button !== 0) return;`,
    `      e.stopPropagation();`
  ];
  const postDragPatchStr = postDragPatchSrc.join("\n");
  retePost = retePost.replace(preDragPatchStr, postDragPatchStr);
  const hasDragPatch = retePost.indexOf(postDragPatchStr) >= 0;

  if (hasZoomPatch && hasDragPatch) {
    console.log("Patch succeeded!");
    if (retePost !== retePre) {
      fs.writeFileSync(retePath, retePost, { encoding: 'utf8' });
    }
  }
  else {
    console.log("Patch failed! Perhaps Rete source changed?");
    process.exit(-1);
  }
}
