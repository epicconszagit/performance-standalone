export const EMAIL_DOMAIN = "epicnetworkgroup.com";

function slugifyLocalPart(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// first-initial + last-name, e.g. "Jane Doe" -> "jdoe"
export function generateEmployeeEmailBase(fullName) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "user";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return slugifyLocalPart(first[0] + last) || "user";
}

export function generateDepartmentEmailBase(name) {
  return slugifyLocalPart(name) || "dept";
}

// Best-effort client-side uniqueness check against already-loaded records.
// The backend is authoritative (it checks the full database), so this is
// just to avoid an obviously-colliding suggestion in the UI.
export function generateUniqueEmail(base, existingEmails = []) {
  const taken = new Set(existingEmails.filter(Boolean).map((e) => e.toLowerCase()));
  let candidate = `${base}@${EMAIL_DOMAIN}`;
  let suffix = 1;
  while (taken.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${base}${suffix}@${EMAIL_DOMAIN}`;
  }
  return candidate;
}
