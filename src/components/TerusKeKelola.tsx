"use client";
// Link dari email Supabase (undangan klien / lupa kata sandi) bisa mendarat di halaman depan
// kalau Supabase memakai Site URL tanpa /kelola. Teruskan ke dashboard beserta isi linknya
// (#access_token=… atau #error_code=…) supaya klien tetap diminta membuat kata sandi.
import { useEffect } from "react";

const POLA_LINK_EMAIL = /(^|[#&?])(access_token|error_code)=/;

export default function TerusKeKelola() {
  useEffect(() => {
    const { hash, search } = window.location;
    if (POLA_LINK_EMAIL.test(hash) || POLA_LINK_EMAIL.test(search)) window.location.replace(`/kelola${search}${hash}`);
  }, []);
  return null;
}
