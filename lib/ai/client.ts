import { google } from "@ai-sdk/google";

// Reads GOOGLE_GENERATIVE_AI_API_KEY from the environment automatically.
// "gemini-flash-latest" tracks Google's current stable flash model instead
// of pinning a dated version, which matters for a fast/cheap in-editor
// feature like this more than it matters for reproducibility.
export const aiModel = google("gemini-flash-latest");
