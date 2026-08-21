import { z } from "zod";

const newsLinkUrlSchema = z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
        message: "Links must use HTTP or HTTPS",
    });

export const zNewsDocument = z
    .object({
        paragraphs: z
            .array(
                z.object({
                    runs: z
                        .array(
                            z.object({
                                text: z.string().max(4000),
                                color: z
                                    .string()
                                    .regex(/^#[0-9a-fA-F]{6}$/)
                                    .optional(),
                                linkUrl: newsLinkUrlSchema.optional(),
                            }),
                        )
                        .max(100),
                }),
            )
            .min(1)
            .max(100),
    })
    .refine(
        (document) =>
            document.paragraphs.reduce(
                (length, paragraph) =>
                    length +
                    paragraph.runs.reduce((sum, run) => sum + run.text.length, 0),
                0,
            ) <= 10_000,
        "News text must be 10,000 characters or fewer",
    );

export type NewsDocument = z.infer<typeof zNewsDocument>;

export interface NewsPost {
    id: number;
    title: string;
    content: string;
    publishedAt: string;
    dateText: string | null;
    document: NewsDocument | null;
}

export interface NewsResponse {
    posts: NewsPost[];
}

export interface ManageNewsPost extends NewsPost {
    isPublished: boolean;
}

export interface ManageNewsResponse {
    posts: ManageNewsPost[];
}

export const zSaveNewsRequest = z.object({
    id: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(100),
    dateText: z.string().trim().min(1).max(60),
    document: zNewsDocument,
    publish: z.boolean(),
});
export type SaveNewsRequest = z.infer<typeof zSaveNewsRequest>;

export const zDeleteNewsRequest = z.object({
    id: z.number().int().positive(),
});
