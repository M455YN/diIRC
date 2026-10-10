/** Stable per-nick colour (classic IRC clients colour nicks so speakers are easy to tell apart). */
export function nickColor(nick: string): string {
  const key = nick.toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 60% 55%)`;
}
