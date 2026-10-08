export default function TidakDitemukan() {
  return (
    <main style={{ minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center", background: "#0F1530", color: "#FBF1E1" }}>
      <img src="/brand/monogram-cream.png" alt="" style={{ width: 90 }} />
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, margin: 0 }}>Undangan tidak ditemukan</h1>
      <p style={{ maxWidth: 340, margin: 0, lineHeight: 1.6, color: "#CFC6DD" }}>Periksa kembali link yang Anda terima, atau hubungi pengirim undangan.</p>
    </main>
  );
}
