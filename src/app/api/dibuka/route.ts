import { z } from "zod";
import { tandaiDibuka } from "@/lib/data";

const Skema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  kode: z.string().regex(/^[a-z0-9]{4,12}$/),
  perangkat: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/).nullable().optional(),
});

// Dipanggil saat tamu menekan "Buka Undangan" (bukan saat halaman dimuat),
// supaya bot pratinjau link WhatsApp tidak ikut tercatat sebagai "dibuka" atau memakai jatah perangkat.
export async function POST(request: Request) {
  const hasil = Skema.safeParse(await request.json().catch(() => null));
  if (!hasil.success) return Response.json({ terkunci: false }, { status: 400 });
  try {
    const { terkunci } = await tandaiDibuka(hasil.data.slug, hasil.data.kode, hasil.data.perangkat ?? null);
    return Response.json({ terkunci }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("tandai dibuka gagal", e);
    // jangan kunci tamu hanya karena gangguan server
    return Response.json({ terkunci: false }, { status: 200 });
  }
}
