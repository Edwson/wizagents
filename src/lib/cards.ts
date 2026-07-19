// Card helpers. We NEVER store the full PAN or CVV — only brand + last4 + expiry.
// In production, tokenize with Stripe.js so the number never touches the server.
export function detectBrand(num: string): string {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(6011|65|64[4-9])/.test(n)) return "discover";
  if (/^35/.test(n)) return "jcb";
  return "card";
}
export function luhnValid(num: string): boolean {
  const n = num.replace(/\D/g, "");
  if (n.length < 12 || n.length > 19) return false;
  let sum = 0, alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = parseInt(n[i], 10);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}
export function expValid(month: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const exp = new Date(year, month, 0, 23, 59, 59);
  return exp >= now;
}
