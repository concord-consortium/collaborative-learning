import { DateTime } from "luxon";

/** A network + station identifier. */
export interface StationId {
  network: string;
  station: string;
}

/** A channel plus its location code.
 *  `location` is the SEED location code; `undefined` and `""` both mean the blank location. */
export interface StationChannel {
  channel: string;
  location?: string;
}

/** Basic station data: a station plus a specific channel and location. */
export interface StationData extends StationId, StationChannel {}

/** A station entry in unit configuration: identity plus optional label. */
export interface StationConfig extends StationData {
  label?: string;
}

/** A station/channel/location plus an ISO time range (e.g. a metadata epoch). */
export interface StationQuery extends StationData {
  startTime: string;
  endTime: string;
}

/** Channel metadata from EarthScope FDSN Station service. */
export interface ChannelMetadata extends StationQuery {
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

/** A series of nullable numbers, used for uPlot data arrays. */
export type NullableNumber = (number | null)
export type NullableNumberArray = NullableNumber[];

/** A raw seismic data segment parsed from miniSEED. */
export interface RawSegment {
  startTime: number;   // Unix seconds
  sampleRate: number;
  samples: Float64Array;
}

/** Parameters for fetching a single envelope tile. */
export interface FetchEnvelopeTileParams {
  stationData: StationData;
  level: number;
  tileIndex: number;
  s3BaseUrl?: string;
  signal?: AbortSignal;
}

/** Viewport parameters for seismic data queries. */
export interface SeismicViewportParams {
  stationData: StationData;
  startTime: DateTime;
  endTime: DateTime;
  pixelWidth: number;
}

/** Result of a seismic query for a viewport. */
export interface ViewportQueryResult {
  level: number | "raw";
  /** uPlot data: [timestamps, mins, maxs] for envelopes; [timestamps, values] for raw */
  data: NullableNumberArray[];
  /** Amplitude range for y-axis scaling */
  amplitudeRange: number;
  /** True if any data is still loading */
  isLoading: boolean;
}
