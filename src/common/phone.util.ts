const INDIA_LOCAL_PHONE = /^[6-9]\d{9}$/;
const INDIA_E164_PHONE = /^\+91[6-9]\d{9}$/;

/** 10-digit local or already-E.164 → `+91XXXXXXXXXX`, or `null` if neither shape matches. */
export function toIndiaE164(value: string): string | null {
  if (INDIA_LOCAL_PHONE.test(value)) {
    return `+91${value}`;
  }

  if (INDIA_E164_PHONE.test(value)) {
    return value;
  }

  return null;
}
