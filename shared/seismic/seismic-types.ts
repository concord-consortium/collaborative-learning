// shared/seismic/seismic-types.ts

/** Channel metadata from EarthScope FDSN Station service. */
export interface ChannelMetadata {
  network: string;
  station: string;
  location: string;
  channel: string;
  startTime: string;
  endTime: string;
  /** Overall sensitivity in counts per physical unit. */
  scale: number;
  scaleFreq: number;
  scaleUnits: string;
  sampleRate: number;
  /** Instrument code: second character of channel code (e.g., "H", "N"). */
  instrumentCode: string;
}

/** A time range [start, end) in seconds since Unix epoch. */
export interface TimeRange {
  start: number;
  end: number;
}

/** A single envelope data point with timestamp. */
export interface EnvelopePoint {
  time: number;
  min: number;
  max: number;
}

/** A decoded envelope tile's data arrays. */
export interface EnvelopeTileData {
  mins: Int16Array;
  maxs: Int16Array;
}
