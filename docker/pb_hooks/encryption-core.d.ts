interface EncRecord { get(field: string): unknown; set(field: string, value: unknown): void; }
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
