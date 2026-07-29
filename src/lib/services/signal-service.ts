import type {
  CreateSignalRecord,
  PublicSignalQuery,
  SignalRepository,
  UpdateSignalRecord,
} from "../repositories/contracts";
import type { Actor, Signal } from "../types";
import {
  AuthenticationRequiredError,
  DraftValidationError,
  ForbiddenError,
  RejectionValidationError,
  SignalNotFoundError,
} from "../domain/errors";
import {
  rejectionInputSchema,
  signalDraftInputSchema,
  type ParsedSignalDraftInput,
  type SignalDraftInput,
} from "../domain/schemas";
import { assertSignalPublishable, zodFieldErrors } from "../domain/validation";

export type { Actor, SignalDraftInput };

export type Clock = () => Date;

function requireAdmin(actor: Actor | null | undefined): Actor {
  if (!actor) {
    throw new AuthenticationRequiredError();
  }

  if (actor.role !== "admin") {
    throw new ForbiddenError();
  }

  return actor;
}
function removeUndefined(
  input: ParsedSignalDraftInput,
): Partial<CreateSignalRecord> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<CreateSignalRecord>;
}

export class SignalService {
  constructor(
    private readonly repository: SignalRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  /**
   * Creates or updates a manually entered draft. Manual entries use
   * pending_review; ai_draft is reserved for weekly policy ingest.
   */
  async saveDraft(
    actor: Actor | null | undefined,
    input: SignalDraftInput,
    signalId?: string,
  ): Promise<Signal> {
    const admin = requireAdmin(actor);
    const result = signalDraftInputSchema.safeParse(input);

    if (!result.success) {
      throw new DraftValidationError(zodFieldErrors(result.error));
    }

    const now = this.clock().toISOString();
    const draftFields = removeUndefined(result.data);

    if (signalId) {
      const existing = await this.repository.getAdminById(signalId);
      if (!existing) {
        throw new SignalNotFoundError(signalId);
      }

      const patch: UpdateSignalRecord = {
        ...draftFields,
        review_status: "pending_review",
        published_at: null,
        reviewer_id: null,
        reviewed_at: null,
        updated_at: now,
      };

      return this.repository.update(signalId, patch);
    }

    const record: CreateSignalRecord = {
      region_id: result.data.region_id ?? null,
      signal_type: result.data.signal_type ?? "policy",
      title: result.data.title ?? null,
      summary: result.data.summary ?? null,
      category: result.data.category ?? null,
      original_status: result.data.original_status ?? null,
      normalized_status: result.data.normalized_status ?? null,
      event_date: result.data.event_date ?? null,
      effective_date: result.data.effective_date ?? null,
      impact_channel: result.data.impact_channel ?? null,
      impact_direction: result.data.impact_direction ?? null,
      impact_level: result.data.impact_level ?? null,
      source_url: result.data.source_url ?? null,
      source_name: result.data.source_name ?? null,
      reviewer_note: result.data.reviewer_note ?? null,
      review_status: "pending_review",
      published_at: null,
      created_at: now,
      updated_at: now,
      is_demo: result.data.is_demo ?? false,
      reviewer_id: null,
      reviewed_at: null,
      created_by: admin.id,
    };

    return this.repository.create(record);
  }

  async publish(
    actor: Actor | null | undefined,
    signalId: string,
    reviewerNote: string,
  ): Promise<Signal> {
    const admin = requireAdmin(actor);
    const signal = await this.repository.getAdminById(signalId);

    if (!signal) {
      throw new SignalNotFoundError(signalId);
    }

    assertSignalPublishable(signal, reviewerNote);

    const now = this.clock().toISOString();
    return this.repository.update(signalId, {
      review_status: "published",
      reviewer_note: reviewerNote.trim(),
      reviewer_id: admin.id,
      reviewed_at: now,
      published_at: now,
      updated_at: now,
    });
  }

  async reject(
    actor: Actor | null | undefined,
    signalId: string,
    reviewerNote: string,
  ): Promise<Signal> {
    const admin = requireAdmin(actor);
    const result = rejectionInputSchema.safeParse({
      reviewer_note: reviewerNote,
    });

    if (!result.success) {
      throw new RejectionValidationError(zodFieldErrors(result.error));
    }

    const signal = await this.repository.getAdminById(signalId);
    if (!signal) {
      throw new SignalNotFoundError(signalId);
    }

    const now = this.clock().toISOString();
    return this.repository.update(signalId, {
      review_status: "rejected",
      reviewer_note: result.data.reviewer_note,
      reviewer_id: admin.id,
      reviewed_at: now,
      published_at: null,
      updated_at: now,
    });
  }

  async listPublic(query: PublicSignalQuery = {}): Promise<Signal[]> {
    const signals = await this.repository.listPublic(query);
    return signals.filter((signal) => signal.review_status === "published");
  }

  async getPublicById(signalId: string): Promise<Signal | null> {
    const signal = await this.repository.getPublicById(signalId);
    return signal?.review_status === "published" ? signal : null;
  }
}
