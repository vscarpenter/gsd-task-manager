export type CspTarget = "cloudfront" | "selfhost";

export function buildCsp(target: CspTarget): string;
