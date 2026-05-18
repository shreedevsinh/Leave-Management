export const getTTLInSeconds = (years): number => {
  const now = Math.floor(Date.now() / 1000);
  const secondsInYear = 365 * 24 * 60 * 60;

  return now + years * secondsInYear;
};