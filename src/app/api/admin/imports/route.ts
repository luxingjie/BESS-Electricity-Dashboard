import { extname } from "node:path";

import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import {
  assertTrustedJsonMutation,
  assertTrustedMultipartMutation,
} from "@/lib/http/security";
import { parseWithSchema, readJsonBody } from "@/lib/http/validation";
import { createUrlImportSchema } from "@/lib/imports/schemas";
import { ImportWorkflowError } from "@/lib/imports/service";
import {
  MAX_IMPORT_FILE_BYTES,
  importObjectPath,
  sha256,
  SupabaseImportBlobStore,
} from "@/lib/imports/storage";
import { SupabaseImportRepository } from "@/lib/imports/supabase-repository";
import { normalizeImportUrl } from "@/lib/imports/url-fetcher";
import { inspectWorkbook } from "@/lib/imports/workbook";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function emptyJobFields(adminId: string) {
  return {
    canonical_url: null,
    storage_path: null,
    extracted_storage_path: null,
    content_hash: null,
    duplicate_of_job_id: null,
    extracted_text: null,
    created_by: adminId,
  } as const;
}

function uploadKind(
  inputType: FormDataEntryValue | null,
  filename: string,
): { inputType: "pdf" | "excel"; extension: string } {
  if (inputType !== "pdf" && inputType !== "excel") {
    throw new ImportWorkflowError(
      "上传类型必须是 pdf 或 excel",
      "UNSUPPORTED_IMPORT_TYPE",
    );
  }
  const extension = extname(filename).toLocaleLowerCase();
  if (inputType === "pdf" && extension !== ".pdf") {
    throw new ImportWorkflowError("PDF 导入只接受 .pdf 文件", "INVALID_FILE_EXTENSION");
  }
  if (inputType === "excel" && ![".xlsx", ".csv"].includes(extension)) {
    throw new ImportWorkflowError(
      "Excel 导入只接受 .xlsx 或 UTF-8 .csv 文件",
      "INVALID_FILE_EXTENSION",
    );
  }
  return { inputType: inputType as "pdf" | "excel", extension };
}

function assertPdfMagic(bytes: Uint8Array) {
  const prefix = Buffer.from(bytes.subarray(0, Math.min(bytes.byteLength, 1_024)));
  if (prefix.indexOf("%PDF-") < 0) {
    throw new ImportWorkflowError("文件没有有效的 PDF 标识", "INVALID_PDF");
  }
}

export async function GET() {
  try {
    await requireAdminApi();
    const client = await createServerSupabaseClient();
    const jobs = await new SupabaseImportRepository(client).listJobs();
    return NextResponse.json({ data: jobs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    const admin = await requireAdminApi();
    const client = await createServerSupabaseClient();
    const repository = new SupabaseImportRepository(client);

    if (contentType.startsWith("application/json")) {
      assertTrustedJsonMutation(request);
      const payload = parseWithSchema(
        createUrlImportSchema.safeParse(await readJsonBody(request)),
      );
      let normalizedUrl: string;
      try {
        normalizedUrl = normalizeImportUrl(payload.source_url);
      } catch (error) {
        const candidate = error as { code?: string; message?: string };
        throw new ImportWorkflowError(
          candidate.message ?? "URL 不符合安全要求",
          candidate.code ?? "INVALID_URL",
        );
      }
      const duplicate = await repository.findUrlDuplicate(normalizedUrl);
      if (duplicate) {
        return NextResponse.json({ data: { job: duplicate, duplicate: true } });
      }
      const url = new URL(normalizedUrl);
      const job = await repository.createJob({
        input_type: "url",
        input_name: `${url.hostname}${url.pathname}`.slice(0, 1_000),
        source_url: payload.source_url,
        normalized_url: normalizedUrl,
        original_filename: null,
        source_mime_type: null,
        original_size_bytes: null,
        file_hash: null,
        input_metadata: {},
        ...emptyJobFields(admin.id),
      });
      return NextResponse.json({ data: { job, duplicate: false } }, { status: 201 });
    }

    assertTrustedMultipartMutation(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ImportWorkflowError("请选择要上传的文件", "FILE_REQUIRED");
    }
    if (file.size <= 0) {
      throw new ImportWorkflowError("上传文件为空", "EMPTY_FILE");
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      throw new ImportWorkflowError(
        `当前部署入口最多支持 ${MAX_IMPORT_FILE_BYTES} 字节文件`,
        "FILE_TOO_LARGE",
        413,
      );
    }
    const kind = uploadKind(form.get("input_type"), file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (kind.inputType === "pdf") assertPdfMagic(bytes);
    const workbookPreview =
      kind.inputType === "excel"
        ? await inspectWorkbook(bytes, {
            filename: file.name,
            previewRows: 20,
            maxBytes: MAX_IMPORT_FILE_BYTES,
          })
        : null;
    const fileHash = sha256(bytes);
    const duplicate = await repository.findFileDuplicate(kind.inputType, fileHash);
    const sourceMimeType =
      kind.inputType === "pdf"
        ? "application/pdf"
        : kind.extension === ".csv"
          ? "text/csv"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (duplicate?.storage_path) {
      return NextResponse.json({ data: { job: duplicate, duplicate: true } });
    }
    if (duplicate && !duplicate.storage_path) {
      const recoveryPath = importObjectPath({
        adminId: admin.id,
        jobId: duplicate.id,
        filename: file.name,
      });
      await new SupabaseImportBlobStore(client).upload(
        recoveryPath,
        bytes,
        sourceMimeType,
      );
      const recovered = await repository.updateJob(duplicate.id, {
        storage_path: recoveryPath,
        input_metadata: workbookPreview
          ? { ...duplicate.input_metadata, workbook_preview: workbookPreview }
          : duplicate.input_metadata,
        status: "pending",
        failure_stage: null,
        error_code: null,
        error_message: null,
        technical_error: null,
        retryable: false,
        completed_at: null,
      });
      return NextResponse.json({
        data: { job: recovered, duplicate: false, recovered: true },
      });
    }

    let job = await repository.createJob({
      input_type: kind.inputType,
      input_name: file.name.slice(0, 1_000),
      source_url: null,
      normalized_url: null,
      original_filename: file.name.slice(0, 1_000),
      source_mime_type: sourceMimeType,
      original_size_bytes: file.size,
      file_hash: fileHash,
      input_metadata: workbookPreview ? { workbook_preview: workbookPreview } : {},
      ...emptyJobFields(admin.id),
    });

    const path = importObjectPath({
      adminId: admin.id,
      jobId: job.id,
      filename: file.name,
    });
    try {
      await new SupabaseImportBlobStore(client).upload(path, bytes, sourceMimeType);
      job = await repository.updateJob(job.id, { storage_path: path });
    } catch (error) {
      await repository.updateJob(job.id, {
        status: "failed",
        failure_stage: "store_source",
        error_code: "IMPORT_STORAGE_ERROR",
        error_message: "原始文件未能保存到私有对象存储",
        technical_error: error instanceof Error ? error.message.slice(0, 8_000) : String(error),
        retryable: true,
        completed_at: new Date().toISOString(),
      });
      throw new ImportWorkflowError(
        "原始文件未能保存到私有对象存储；任务已记录，可检查 Storage 配置后重试",
        "IMPORT_STORAGE_ERROR",
        503,
        true,
      );
    }

    return NextResponse.json({ data: { job, duplicate: false } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
