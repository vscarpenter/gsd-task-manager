interface EncRecord { get(field: string): any; set(field: string, value: any): void; }
declare const core: {
  PREFIX: string;
  ENCRYPTED_TEXT_FIELDS: string[];
  ENCRYPTED_JSON_FIELDS: string[];
  isEncrypted(v: unknown): boolean;
  requireValidKey(key: unknown): void;
  encryptRecord(record: EncRecord, cipherFn: (s: string) => string): void;
  decryptRecord(record: EncRecord, decipherFn: (s: string) => string): void;
};
export default core;
