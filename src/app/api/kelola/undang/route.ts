// Khusus admin Momenmu (tab Klien → Akun klien → Kirim undangan):
// buat akun klien + kirim email undangan Supabase, lalu sambungkan akun itu ke acara.
//
// Keamanan:
// - Kunci rahasia Supabase (SUPABASE_SERVICE_ROLE_KEY, disimpan integrasi Supabase di Vercel, tidak pernah ke browser)
//   HANYA dipakai untuk inviteUserByEmail.
// - Pemeriksaan admin dan penyambungan acara memakai token akun yang sedang masuk lewat fungsi database
//   is_staf() dan sambungkan_pemilik(), jadi aturan aksesnya sama persis dengan dashboard. Token palsu ditolak database.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Skema = z.object({
  acaraId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
});

const tanpaSesi = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

function jawab(status: number, isi: Record<string, unknown>) {
  return Response.json(isi, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const rahasia = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !rahasia) return jawab(503, { galat: "belum_disetel" });

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return jawab(401, { galat: "belum_masuk" });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jawab(400, { galat: "email_tidak_valid" });
  }
  const hasil = Skema.safeParse(json);
  if (!hasil.success) return jawab(400, { galat: "email_tidak_valid" });
  const { acaraId, email } = hasil.data;

  // 1. Hanya admin Momenmu (dicek database dengan token yang masuk)
  const sbAkun = createClient(url, anon, { ...tanpaSesi, global: { headers: { Authorization: `Bearer ${token}` } } });
  const staf = await sbAkun.rpc("is_staf");
  if (staf.error) return staf.status === 401 ? jawab(401, { galat: "belum_masuk" }) : jawab(403, { galat: "khusus_admin" });
  if (staf.data !== true) return jawab(403, { galat: "khusus_admin" });

  // 2. Acaranya masih ada
  const acara = await sbAkun.from("events").select("id").eq("id", acaraId).maybeSingle();
  if (acara.error) return jawab(500, { galat: "gagal" });
  if (!acara.data) return jawab(404, { galat: "acara_tidak_ditemukan" });

  // 3. Kirim undangan (akun dibuat otomatis). Email yang sudah punya akun cukup disambungkan.
  //    Link di email membuka /kelola; kalau alamat ini belum diizinkan di Supabase, Supabase memakai Site URL.
  //    Di produksi selalu domain produksi (bukan alias lain yang kebetulan dipakai admin), supaya cocok dengan Redirect URLs.
  const produksi = process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const situs = (process.env.NEXT_PUBLIC_SITE_URL || (produksi ? `https://${produksi}` : new URL(request.url).origin)).replace(/\/$/, "");
  const kunci = createClient(url, rahasia, tanpaSesi);
  const undang = await kunci.auth.admin.inviteUserByEmail(email, { redirectTo: `${situs}/kelola` });
  let status: "diundang" | "sudah_ada" = "diundang";
  if (undang.error) {
    const e = undang.error;
    if (e.code === "email_exists" || /already (been )?registered/i.test(e.message)) status = "sudah_ada";
    else if (e.status === 429 || e.code === "over_email_send_rate_limit") return jawab(429, { galat: "batas_email" });
    else if (e.code === "email_address_not_authorized" || /cannot be used as it is not authorized/i.test(e.message)) return jawab(400, { galat: "email_belum_diizinkan" });
    else if (e.code === "email_address_invalid" || e.code === "validation_failed") return jawab(400, { galat: "email_tidak_valid" });
    else {
      console.error("Undang klien gagal", e.status, e.code); // tanpa email/token di log
      return jawab(502, { galat: "gagal" });
    }
  }

  // 4. Sambungkan acara ke akun itu (fungsi khusus admin di database)
  const sambung = await sbAkun.rpc("sambungkan_pemilik", { p_acara: acaraId, p_email: email });
  if (sambung.error) return jawab(500, { galat: "gagal_sambung", status });
  return jawab(200, { email: (sambung.data as string | null) ?? email, status });
}
