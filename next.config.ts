import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Undangan selalu dirender per permintaan (data tamu & RSVP berubah terus),
  // jadi kita pakai model caching sebelumnya yang lebih sederhana.
  cacheComponents: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Keamanan dasar untuk semua halaman (dashboard tidak bisa ditanam di situs lain, dsb.)
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
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
