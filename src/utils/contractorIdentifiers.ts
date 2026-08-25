export const normalizePan = (value: string) => value.replace(/\s+/g, "").toUpperCase();
export const normalizeGst = (value: string) => value.replace(/\s+/g, "").toUpperCase();
export const normalizeMobile = (value: string) => value.replace(/^\+91/, "").replace(/\D/g, "");
export const maskPan = (value?: string) => value ? `${value.slice(0, 5)}****${value.slice(-1)}` : "—";
export const maskGst = (value?: string) => value ? `${value.slice(0, 4)}*******${value.slice(-4)}` : "—";
export const isValidPan = (value: string) => !value || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizePan(value));
export const isValidGst = (value: string) => !value || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalizeGst(value));
