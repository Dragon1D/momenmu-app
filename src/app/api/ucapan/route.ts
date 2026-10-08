import { daftarUcapan, ringkasanKehadiran } from "@/lib/data";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return Response.json({ error: "Slug tidak valid." }, { status: 400 });
  const [ucapan, ringkasan] = await Promise.all([daftarUcapan(slug), ringkasanKehadiran(slug)]);
  return Response.json({ ucapan, ringkasan }, { headers: { "Cache-Control": "no-store" } });
}
