// Share code helpers (original format) and 0G mapping helpers
// NOTE: Share code keeps the original look: privshare://0g-xxxx-xxxx-xxxx-xxxx
// Mapping information is moved from IPFS to 0G Storage.

import { zgStorage } from "./0g-storage";

// Original share code format: privshare://0g-<4 groups of [a-z0-9]{4}>
const SHARE_CODE_PREFIX = "privshare://0g-";
const SHARE_CODE_BODY_GROUPS = 4;
const SHARE_CODE_GROUP_LENGTH = 4;
const SHARE_CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomGroup(): string {
  let s = "";
  for (let i = 0; i < SHARE_CODE_GROUP_LENGTH; i++) {
    const idx = Math.floor(Math.random() * SHARE_CODE_ALPHABET.length);
    s += SHARE_CODE_ALPHABET[idx];
  }
  return s;
}

export function generateShareCode(): string {
  const groups = Array.from({ length: SHARE_CODE_BODY_GROUPS }, () => randomGroup()).join("-");
  return `${SHARE_CODE_PREFIX}${groups}`;
}

export function validateShareCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  const pattern = new RegExp(
    `^${SHARE_CODE_PREFIX}([a-z0-9]{${SHARE_CODE_GROUP_LENGTH}}-){${SHARE_CODE_BODY_GROUPS - 1}}[a-z0-9]{${SHARE_CODE_GROUP_LENGTH}}$`
  );
  return pattern.test(code);
}

export function extractCodeFromShareCode(code: string): string {
  if (!validateShareCode(code)) throw new Error("Invalid share code format");
  return code.replace(SHARE_CODE_PREFIX, "");
}

export type MappingRecord = {
  rootHash: string; // 0G pieceCid/root hash of the actual file
  iv?: string; // encryption IV if the file is encrypted
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploader?: string;
  uploadTime?: number;
  txHash?: string;
};

function saveMappingLocally(shareCode: string, record: any) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = `privshare:mapping:${shareCode}`;
      window.localStorage.setItem(key, JSON.stringify(record));
    }
  } catch (e) {
    console.warn('Failed to save mapping to localStorage:', e);
  }
}

function loadMappingLocally(shareCode: string): MappingRecord | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = `privshare:mapping:${shareCode}`;
      const raw = window.localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
    }
    return null;
  } catch (e) {
    console.warn('Failed to load mapping from localStorage:', e);
    return null;
  }
}

// Store mapping info to 0G as a small JSON file.
// IMPORTANT: This persists mapping data to 0G, but discovering it by share code
// still requires an index/search capability (e.g., via tags or external index).
export async function storeMappingTo0G(
  shareCode: string,
  record: MappingRecord,
  signer: any
): Promise<{ rootHash?: string; txHash?: string }> {
  if (!validateShareCode(shareCode)) throw new Error("Invalid share code format");

  const payload = {
    code: extractCodeFromShareCode(shareCode),
    ...record,
  };
  const json = JSON.stringify(payload, null, 2);
  const file = new File([json], `privshare-mapping-${Date.now()}.json`, {
    type: "application/json",
  });

  const res = await zgStorage.uploadFile(file, signer);

  // Best-effort local cache for immediate retrieval on the same device
  saveMappingLocally(shareCode, {
    ...record,
    rootHash: record.rootHash,
    iv: record.iv,
    txHash: res?.txHash || record.txHash,
  });

  return { rootHash: res?.rootHash, txHash: res?.txHash };
}

// Retrieve mapping info from 0G.
// Without a search/index API keyed by share code, this cannot be resolved client-side.
// Fallback: try localStorage cache saved during upload.
export async function getMappingFrom0G(shareCode: string): Promise<MappingRecord> {
  if (!validateShareCode(shareCode)) throw new Error("Invalid share code format");

  const local = loadMappingLocally(shareCode);
  if (local) return local;

  throw new Error(
    "Mapping record not found."
  );
}