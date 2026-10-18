// iOS Safari gets the iOS (Liquid Glass) look, Android the Material one.
export const type = () => {
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : "android";
  throw new Error("not a phone");
};
