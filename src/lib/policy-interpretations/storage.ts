import "server-only";

import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

export const POLICY_BRIEF_STORAGE_BUCKET = "grid-ledger-policy-briefs";
export const MAX_POLICY_BRIEF_FILE_BYTES = 20 * 1024 * 1024;

export const POLICY_BRIEF_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".csv",
] as const;

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
};

export class PolicyBriefStorageError extends Error {
  readonly status = 503;
  readonly code = "POLICY_BRIEF_STORAGE_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "PolicyBriefStorageError";
  }
}

export function policyBriefExtension(filename: string): string {
  const extension = extname(filename).toLocaleLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(extension) ? extension : "";
}

export function mimeForPolicyBrief(filename: string, fallback?: string | null): string {
  const ext = policyBriefExtension(filename);
  return EXT_TO_MIME[ext] ?? fallback ?? "application/octet-stream";
}

export function assertPolicyBriefUpload(input: {
  filename: string;
  size: number;
}): { extension: string; mimeType: string } {
  const extension = policyBriefExtension(input.filename);
  if (
    !POLICY_BRIEF_ALLOWED_EXTENSIONS.includes(
      extension as (typeof POLICY_BRIEF_ALLOWED_EXTENSIONS)[number],
    )
  ) {
    throw Object.assign(
      new Error("仅支持 Word / PDF / PPT / Excel（含 CSV）文件"),
      { status: 400, code: "UNSUPPORTED_FILE_TYPE" },
    );
  }
  if (input.size <= 0 || input.size > MAX_POLICY_BRIEF_FILE_BYTES) {
    throw Object.assign(
      new Error("单个文件需大于 0 且不超过 20 MB"),
      { status: 400, code: "FILE_TOO_LARGE" },
    );
  }
  return { extension, mimeType: mimeForPolicyBrief(input.filename) };
}

export function policyBriefObjectPath(input: {
  adminId: string;
  briefId: string;
  filename: string;
}): string {
  const extension = policyBriefExtension(input.filename);
  return `${input.adminId}/${input.briefId}/${randomUUID()}${extension}`;
}

export class SupabasePolicyBriefBlobStore {
  constructor(private readonly client: SupabaseClient) {}

  async upload(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(POLICY_BRIEF_STORAGE_BUCKET)
      .upload(path, bytes, {
        contentType,
        upsert: false,
        cacheControl: "0",
      });
    if (error) {
      throw new PolicyBriefStorageError(`解读文件保存失败：${error.message}`);
    }
  }

  async download(path: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage
      .from(POLICY_BRIEF_STORAGE_BUCKET)
      .download(path);
    if (error || !data) {
      throw new PolicyBriefStorageError(
        `解读文件读取失败：${error?.message ?? "对象不存在"}`,
      );
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async remove(path: string): Promise<void> {
    const { error } = await this.client.storage
      .from(POLICY_BRIEF_STORAGE_BUCKET)
      .remove([path]);
    if (error) {
      throw new PolicyBriefStorageError(`解读文件删除失败：${error.message}`);
    }
  }
}
