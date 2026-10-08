import type { Metadata } from "next";
import { HalamanUndangan, metadataUndangan } from "../tampil";

// Link pribadi tamu: momenmu.id/arya-nadia/dn7s
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; kode: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, kode } = await params;
  return metadataUndangan(slug.toLowerCase(), kode.toLowerCase());
}

export default async function Page({ params }: Props) {
  const { slug, kode } = await params;
  return <HalamanUndangan slug={slug.toLowerCase()} kode={kode.toLowerCase()} />;
}
