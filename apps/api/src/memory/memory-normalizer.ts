export const memoryCategories = [
  "preference",
  "personal_fact",
  "relationship_fact",
  "promise",
  "boundary",
] as const;

export type MemoryCategory = (typeof memoryCategories)[number];

export type Memory = {
  category: MemoryCategory;
  content: string;
};

export type ProviderMemorySuggestion = {
  type?: unknown;
  category?: unknown;
  text?: unknown;
  content?: unknown;
  memory?: unknown;
};

const categoryAliases: Record<string, MemoryCategory> = {
  preference: "preference",
  user_preference: "preference",
  personal_fact: "personal_fact",
  personal_info: "personal_fact",
  personal_information: "personal_fact",
  relationship_fact: "relationship_fact",
  relationship_info: "relationship_fact",
  promise: "promise",
  commitment: "promise",
  boundary: "boundary",
  user_boundary: "boundary",
};

export function normalizeMemorySuggestion(
  suggestion: ProviderMemorySuggestion,
): Memory | null {
  const providerCategory = suggestion.category ?? suggestion.type;
  const category =
    typeof providerCategory === "string"
      ? categoryAliases[providerCategory.trim().toLowerCase()]
      : undefined;

  const providerContent = suggestion.content ?? suggestion.text ?? suggestion.memory;
  const content = typeof providerContent === "string" ? providerContent.trim() : "";

  if (!category || !content) {
    return null;
  }

  return { category, content };
}
