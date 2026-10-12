export const kWaveRunnerTileType = "WaveRunner";

// The tile's height is known, not measured. kWaveRunnerPanelHeight is the Status and Output
// panel's own height; see components/_tile-metrics.scss for that arithmetic. kWaveRunnerChromeHeight
// is empirical rather than summed from a breakdown: the tile's own title bar is absolutely
// positioned (see tile-title-area.scss) and so takes no layout space, unlike the toolbar and the
// teal title background above the panel, which do - there is no honest line-by-line total to give.
//
// Side by side, the tile holds one panel's worth. Stacked, the panels sit one above the other, so
// it holds two.
const kWaveRunnerPanelHeight = 164;
const kWaveRunnerChromeHeight = 78;

export const kWaveRunnerDefaultHeight = kWaveRunnerPanelHeight + kWaveRunnerChromeHeight;
export const kWaveRunnerStackedHeight = kWaveRunnerPanelHeight * 2 + kWaveRunnerChromeHeight;
