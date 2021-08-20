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

export const getLocalTimeStamp = (time: number) => { //returns 14NOV19-12:05:33
  const start = new Date(time);
  const year = start.getFullYear();
  const month = start.getMonth();
  const day = start.getDate();
  const hours = start.getHours();
  const minutes = start.getMinutes();
  const seconds = start.getSeconds();
  // This returns a three-letter abbreviated month in EN-US
  const monthsEN = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
  const abbrMonth = monthsEN[month].slice(0, 3).toUpperCase();
  // Returns two-digit years
  const abbrYear = year.toString().substr(-2);
  // For single-digit hours, minutes, seconds, days, this pads a starting 0
  // Otherwise it returns the original two-digits
  const fullDay = (`0${day}`).slice(-2);
  const fullHours = (`0${hours}`).slice(-2);
  const fullMinutes = (`0${minutes}`).slice(-2);
  const fullSeconds = (`0${seconds}`).slice(-2);
  return `${fullDay}${abbrMonth}${abbrYear}-${fullHours}:${fullMinutes}:${fullSeconds}`;
};

export const getDisplayTimeDate = (time: number) => { //returns 12:05 PM Nov 14
  const start = new Date(time);
  const month = start.getMonth();
  const day = start.getDate();
  const hours = start.getHours();
  const minutes = start.getMinutes();
  const fullMinutes = (`0${minutes}`).slice(-2);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const full12Hours = (`0${hours12}`).slice(-2);
  // This returns a three-letter abbreviated month in EN-US
  const monthsEN = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
  const abbrMonth = monthsEN[month].slice(0, 3);
  return `${full12Hours}:${fullMinutes} ${ampm} ${abbrMonth} ${day}`;
};
