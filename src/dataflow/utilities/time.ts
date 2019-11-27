export const getLocalTimeStamp = (time: number) => {
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
