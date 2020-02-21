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
  let retePost = retePre;

  /*
   * The Drag patch limits dragging to the primary mouse button, to prevent
   * nodes from getting stuck to the mouse after right-button clicks.
   * Proposed fix to Rete: https://github.com/retejs/rete/pull/404.
   * Merged on 2020-01-11; published in 1.43-rc.1.
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

  if (hasDragPatch) {
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
