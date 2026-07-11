import { Prisma, type PrismaClient } from '@prisma/client';
import type { ChatExtractionRepository, ExtractionRecord } from '../application/ports.js';

/**
 * Append-only persistence of every AI extraction (raw + validated + applied +
 * rejected + validation status + model + prompt version + timing). This is the
 * audit trail of everything the model ever proposed; raw output never leaves
 * the server in a public response.
 */
export class PrismaChatExtractionRepository implements ChatExtractionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
  ) {}

  async save(record: ExtractionRecord): Promise<void> {
    await this.prisma.aiExtraction.create({
      data: {
        companyId: this.companyId,
        sessionId: record.sessionId,
        messageId: record.messageId,
        model: record.model,
        promptVersion: record.promptVersion,
        rawOutput: json(record.rawOutput),
        validatedOutput: nullableJson(record.validatedOutput),
        valid: record.valid,
        errors: nullableJson(record.errors),
        appliedFields: nullableJson(record.appliedFields),
        latencyMs: record.latencyMs,
        tokensIn: record.tokensIn,
        tokensOut: record.tokensOut,
      },
    });
  }

  async countInvalid(sessionId: string): Promise<number> {
    return this.prisma.aiExtraction.count({
      where: { sessionId, companyId: this.companyId, valid: false },
    });
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

function nullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}
