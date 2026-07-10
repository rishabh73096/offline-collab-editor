export async function fetchCollabToken(documentId: string): Promise<string> {
  const response = await fetch(`/api/collab-token?documentId=${encodeURIComponent(documentId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch collab token (${response.status})`);
  }
  const data: { token: string } = await response.json();
  return data.token;
}
