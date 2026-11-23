/** Normalises a Haitian phone (+509 XXXX XXXX) or an email. Returns null if invalid. */
export function normalizeContact(raw: string): { kind: "phone" | "email"; value: string } | null {
  const s = raw.trim();
  if (!s || s.length > 254) return null;
  if (s.includes("@")) {
    const email = s.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? { kind: "email", value: email } : null;
  }
  let digits = s.replace(/[^\d]/g, "");
  if (digits.startsWith("00509")) digits = digits.slice(2);
  if (digits.length === 8) digits = `509${digits}`;
  // Haitian mobiles: 8 digits after 509, first digit 2–5 (Digicel / Natcom ranges) or 3/4.
  return /^509[2-5]\d{7}$/.test(digits) ? { kind: "phone", value: `+${digits}` } : null;
}
