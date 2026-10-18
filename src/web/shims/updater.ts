// Updates ship with the hosted PWA (service worker), never through the in-app updater.
export class Update {
  version = "";
  body = "";
  constructor(_meta?: unknown) {}
  downloadAndInstall = async () => undefined;
}
export const check = async () => null;
