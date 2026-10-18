export const writeText = (t: string) => navigator.clipboard.writeText(t);
export const readImage = async () => { throw new Error("Image clipboard is not available in the browser"); };
