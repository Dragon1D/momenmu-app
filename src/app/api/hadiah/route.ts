import { z } from "zod";
import { ambilHadiah } from "@/lib/data";

const Skema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  kode: z.string().regex(/^[a-z0-9]{4,12}$/),
  perangkat: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/),
});

// Rekening & alamat kado tidak ditanam di halaman; diambil setelah tamu membuka undangan
// dari perangkat yang terdaftar. Link yang diteruskan ke perangkat ke-4 dst. tidak mendapatkannya.
export async function POST(request: Request) {
  const hasil = Skema.safeParse(await request.json().catch(() => null));
  if (!hasil.success) return Response.json({ hadiah: null }, { status: 400 });
  try {
    const hadiah = await ambilHadiah(hasil.data.slug, hasil.data.kode, hasil.data.perangkat);
    return Response.json({ hadiah }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("ambil hadiah gagal", e);
    return Response.json({ hadiah: null }, { status: 500 });
  }
}
