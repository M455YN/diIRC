// The Android layout is used for every phone/tablet, iOS Safari included.
export const type = () => {
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return "android";
  throw new Error("not a phone");
};
