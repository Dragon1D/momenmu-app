import { z } from "zod";
import { ErrorUndangan, kirimRsvp, ringkasanKehadiran } from "@/lib/data";
import { verifikasiTurnstile } from "@/lib/turnstile";

const Skema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  kode: z.string().regex(/^[a-z0-9]{4,12}$/).nullable(),
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(80, "Nama maksimal 80 karakter."),
  kehadiran: z.enum(["hadir", "tidak"]),
  jumlah: z.number().int().min(0).max(20),
  pesan: z.string().trim().max(500, "Ucapan maksimal 500 karakter."),
  turnstile: z.string().optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const hasil = Skema.safeParse(json);
  if (!hasil.success) {
    const pesan = hasil.error.issues[0]?.message ?? "Data tidak valid.";
    return Response.json({ error: pesan }, { status: 400 });
  }
  const d = hasil.data;
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifikasiTurnstile(d.turnstile, ip))) {
    return Response.json({ error: "Verifikasi anti-spam gagal. Muat ulang halaman lalu coba lagi." }, { status: 403 });
  }
  try {
    const ucapan = await kirimRsvp({ slug: d.slug, kode: d.kode, nama: d.nama, kehadiran: d.kehadiran, jumlah: d.jumlah, pesan: d.pesan });
    const ringkasan = await ringkasanKehadiran(d.slug);
    return Response.json({ ucapan, ringkasan }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ErrorUndangan) return Response.json({ error: e.message, kode: e.kode }, { status: e.status });
    console.error("RSVP gagal", e);
    return Response.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}
