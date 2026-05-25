const BASE = "/api";

export async function sendChat(query, topK = 4) {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat request failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function listDocuments() {
  const res = await fetch(`${BASE}/documents`);
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json();
}

export async function deleteDocument(uploadId) {
  const res = await fetch(`${BASE}/documents/${encodeURIComponent(uploadId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Upload one file via multipart/form-data. Reports progress via the optional
 * `onProgress` callback (0-1). Resolves with the parsed UploadResponse.
 */
export function uploadDocument(file, { category, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    if (category) form.append("category", category);

    xhr.open("POST", `${BASE}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid server response"));
        }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body.detail) msg = body.detail;
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}
