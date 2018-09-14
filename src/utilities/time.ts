// adapted from https://github.com/digplan/time-ago

interface DurationMap {
  [key: string]: number;
}
const durationMap: DurationMap = {
  second: 1,
  minute: 60,
  hour: 60 * 60,
  day: 24 * 60 * 60,
  week: 7 * 24 * 60 * 60,
  month: 30 * 24 * 60 * 60,
  year: 365 * 24 * 60 * 60
};

export const timeAgo = (timestamp: number) => {
  let secondsAgo = Math.round((Date.now() - timestamp) / 1000);
  const when = secondsAgo >= 0 ? "ago" : "from now";
  const durations = Object.keys(durationMap);

  if (secondsAgo < 10) {
    return "Just now";
  }
  if (secondsAgo < 0 ) {
    secondsAgo *= -1;
  }

  for (let durationIndex = 0; durationIndex < durations.length; durationIndex++) {
    const nextDurationLimit = durationMap[durations[durationIndex + 1]];
    if (!nextDurationLimit || (secondsAgo < nextDurationLimit)) {
      const duration = durations[durationIndex];
      const durationLimit = durationMap[duration];
      const durationAmount = Math.round(secondsAgo / durationLimit);
      return `${durationAmount} ${duration}${(durationAmount > 1 ? "s" : "")} ${when}`;
    }
  }
};

export const niceDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString();
};

export const niceDateTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString();
};
