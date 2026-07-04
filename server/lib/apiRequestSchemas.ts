import { z, type ZodSchema } from 'zod';

const optionalTrimmedString = (max = 200) => z.string().trim().min(1).max(max).optional();
const workspaceIdSchema = optionalTrimmedString(160);
const meetingIdSchema = optionalTrimmedString(160);
const recordingIdSchema = optionalTrimmedString(160);

export const processingModeSchema = z.enum(['fast', 'full']);

export const transcriptionStartRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    processingMode: processingModeSchema.optional(),
  })
  .passthrough();

export const transcriptionRetryRequestSchema = transcriptionStartRequestSchema.extend({
  force: z.boolean().optional(),
});

export const audioContentTypeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (value) =>
      value.startsWith('audio/') ||
      value.startsWith('multipart/form-data') ||
      value === 'video/webm' ||
      value === 'application/octet-stream',
    'contentType musi wskazywac obslugiwany typ audio.'
  );

export const chunkFinalizeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    meetingId: meetingIdSchema,
    contentType: audioContentTypeSchema.optional(),
    total: z.coerce.number().int().positive().max(600),
  })
  .passthrough();

const looseRecordSchema = z.record(z.string(), z.unknown());

export const aiAnalyzeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    meetingId: meetingIdSchema,
    recordingId: recordingIdSchema,
    recording_id: recordingIdSchema,
    meeting: looseRecordSchema.optional(),
    segments: z.array(looseRecordSchema).max(500).optional(),
  })
  .passthrough();

const transcriptSegmentSchema = z
  .object({
    speakerName: z.string().trim().max(160).optional(),
    speakerId: z.union([z.number().int().nonnegative(), z.string().trim().min(1)]).optional(),
    text: z.string().trim().min(1).max(5000),
    meetingTitle: z.string().trim().max(240).optional(),
  })
  .passthrough();

export const aiPersonProfileRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    meetingId: meetingIdSchema,
    personName: z.string().trim().min(1).max(160),
    meetings: z.array(looseRecordSchema).max(100).default([]),
    allSegments: z.array(transcriptSegmentSchema).max(1000),
  })
  .passthrough();

export const aiSuggestTasksRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    meetingId: meetingIdSchema,
    transcript: z.array(transcriptSegmentSchema).max(500).default([]),
    people: z
      .array(
        z
          .object({
            name: z.string().trim().max(160).optional(),
            email: z.string().trim().max(254).optional(),
          })
          .passthrough()
      )
      .max(100)
      .default([]),
  })
  .passthrough();

export const aiSearchRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    meetingId: meetingIdSchema,
    query: z.string().trim().min(2).max(200),
    items: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(160),
            title: z.string().trim().min(1).max(240),
            subtitle: z.string().trim().max(500).optional(),
            type: z.string().trim().max(80).optional(),
            group: z.string().trim().max(120).optional(),
          })
          .passthrough()
      )
      .min(1)
      .max(100),
  })
  .passthrough();

export function aiRequestSchemaForPath(path: string): ZodSchema<unknown> {
  if (path.endsWith('/person-profile')) return aiPersonProfileRequestSchema;
  if (path.endsWith('/suggest-tasks')) return aiSuggestTasksRequestSchema;
  return aiSearchRequestSchema;
}

export const voiceProfileFromSpeakerRequestSchema = z
  .object({
    speakerId: z.union([z.string().trim().min(1).max(160), z.number().int().nonnegative()]),
    speakerName: z.string().trim().min(1).max(160),
    segments: z.array(looseRecordSchema).max(100).optional(),
  })
  .passthrough();

export const voiceCoachingRequestSchema = z
  .object({
    speakerId: z.union([z.string().trim().min(1).max(160), z.number().int().nonnegative()]),
    segments: z.array(looseRecordSchema).max(100).optional(),
  })
  .passthrough();

export const liveTranscriptionHeadersSchema = z.object({
  contentType: audioContentTypeSchema,
});

export type AiAnalyzeRequestContract = z.infer<typeof aiAnalyzeRequestSchema>;
export type ChunkFinalizeRequestContract = z.infer<typeof chunkFinalizeRequestSchema>;
export type TranscriptionStartRequestContract = z.infer<typeof transcriptionStartRequestSchema>;
export type VoiceProfileFromSpeakerRequestContract = z.infer<
  typeof voiceProfileFromSpeakerRequestSchema
>;
