// Verifikasi Cloudflare Turnstile (anti-spam form ucapan).
// Aktif hanya jika TURNSTILE_SECRET_KEY diisi. Tanpa itu, verifikasi dilewati.
export async function verifikasiTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const hasil = (await res.json()) as { success?: boolean };
    return hasil.success === true;
  } catch {
    return false;
  }
}
