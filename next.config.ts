import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Undangan selalu dirender per permintaan (data tamu & RSVP berubah terus),
  // jadi kita pakai model caching sebelumnya yang lebih sederhana.
  cacheComponents: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Halaman undangan pribadi: jangan diindeks mesin pencari.
        source: "/:slug/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/tema/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
