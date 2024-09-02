import z from "zod";

const configSchema = z.object({
  GLIDE_PROJECT_ID: z.string(),
});

export const config = configSchema.parse(process.env);
