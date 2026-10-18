export const readFile = async (): Promise<Uint8Array> => { throw new Error("File system access is not available in the browser"); };
export const stat = readFile;
export const writeFile = readFile;
