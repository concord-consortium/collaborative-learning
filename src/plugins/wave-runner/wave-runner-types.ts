export const kWaveRunnerTileType = "WaveRunner";

// The tile's height is known, not measured. These come from the Status and Output panel's own
// vertical rhythm, which is pinned in components/_tile-metrics.scss: its title, the graph box, the
// two status lines and the counts row, plus the section padding, total 233px. On top of that sit
// the tile's title bar, the teal title background and the content padding.
//
// Side by side, the tile holds one panel's worth. Stacked, the panels sit one above the other, so
// it holds two.
const kWaveRunnerPanelHeight = 233;
const kWaveRunnerChromeHeight = 78;

export const kWaveRunnerDefaultHeight = kWaveRunnerPanelHeight + kWaveRunnerChromeHeight;
export const kWaveRunnerStackedHeight = kWaveRunnerPanelHeight * 2 + kWaveRunnerChromeHeight;
