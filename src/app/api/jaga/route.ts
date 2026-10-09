import { modeDemo, ringkasanKehadiran } from "@/lib/data";

// Dipanggil otomatis oleh Vercel Cron sekali sehari (lihat vercel.json).
// Supabase gratis menjeda proyek yang tidak dipakai 1 minggu; satu query ringan per hari
// menjaga database tetap aktif selama masa sebelum undangan disebar.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rahasia = process.env.CRON_SECRET;
  if (rahasia && request.headers.get("authorization") !== `Bearer ${rahasia}`) {
    return new Response("Tidak diizinkan", { status: 401 });
  }
  if (modeDemo) return Response.json({ ok: true, demo: true });
  try {
    await ringkasanKehadiran("momenmu-jaga");
    return Response.json({ ok: true, waktu: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("jaga database gagal", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
