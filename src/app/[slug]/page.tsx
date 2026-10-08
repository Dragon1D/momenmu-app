import type { Metadata } from "next";
import { HalamanUndangan, metadataUndangan } from "./tampil";

// Link umum: momenmu.id/arya-nadia (tanpa nama tamu)
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return metadataUndangan(slug.toLowerCase(), null);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <HalamanUndangan slug={slug.toLowerCase()} kode={null} />;
}
