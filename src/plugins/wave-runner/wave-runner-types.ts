export const kWaveRunnerTileType = "WaveRunner";

// The tile's height is known, not measured. kWaveRunnerPanelHeight is the Status and Output
// panel's own height; see components/_tile-metrics.scss for that arithmetic. chromeHeight adds the
// tile's title bar, teal title background and content padding on top of it.
//
// Side by side, the tile holds one panel's worth. Stacked, the panels sit one above the other, so
// it holds two.
const kWaveRunnerPanelHeight = 164;
const kWaveRunnerChromeHeight = 78;

export const kWaveRunnerDefaultHeight = kWaveRunnerPanelHeight + kWaveRunnerChromeHeight;
export const kWaveRunnerStackedHeight = kWaveRunnerPanelHeight * 2 + kWaveRunnerChromeHeight;
