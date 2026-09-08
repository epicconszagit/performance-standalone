import { apiClient } from "./client";

export async function UploadFile({ file }) {
  const formData = new FormData();
  formData.append("file", file);
  const result = await apiClient.postForm("/uploads", formData);
  return { file_url: result.file_url, file_name: result.file_name };
}

export async function SendEmail({ to, subject, body }) {
  // Server-side stub: logs the email instead of sending it until SMTP is configured.
  return apiClient.post("/send-email", { to, subject, body });
}
