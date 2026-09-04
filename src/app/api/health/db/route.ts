// ============================================================================
// Supabase Keep-Alive — /api/health/db
// ============================================================================
// Supabase free-tier projeleri ~7 gün API/DB aktivitesi almazsa otomatik olarak
// DURAKLATILIR (paused). Ana keep-alive (/api/health) Supabase'i bilinçli olarak
// bypass ettiği için (auth quota) Supabase'i ayakta TUTMAZ — sadece Render'ı
// uyanık tutar. Bu ayrı endpoint günde birkaç kez cron ile pinglenerek
// Supabase'in aktivite sayacını sıfırlar ve otomatik pause'u önler.
//
// GÜVENLİK — bilinçli olarak zararsız:
//   • SALT-OKUNUR: mevcut get_public_catalog RPC'sine (anon'a açık, SECURITY
//     DEFINER) geçersiz bir sentinel token yollar → 200 null döner. Hiçbir veri
//     OKUNMAZ / YAZILMAZ / SİLİNMEZ. Veri kaybı riski yok.
//   • Girdi almaz, token hardcoded → yeni saldırı yüzeyi yok (get_public_catalog
//     zaten public bir uçtur).
//   • Path /api/health/* altında olduğu için middleware'de zaten public
//     (isPublicPath → startsWith '/api/health/'); routing/obscurity mantığına
//     DOKUNULMADI.
//   • Rate-limit: IP başına 6/dk (healthDbRateLimit). Auth yok — meşru çağıran
//     cron; limit DB/quota DoS amplifikasyonunu engeller.
//   • DB hatasında 503 döner (fail-closed) — uptime check DB'yi yanlışlıkla
//     sağlıklı görmesin.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { getClientIp, healthDbRateLimit } from "@/lib/rateLimit";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Sentinel token — catalog_shares token'ları random uuidv4, bu değerle asla
// eşleşmez; RPC her zaman null döner. Amaç yalnızca DB'ye bir istek ulaştırmak.
const SENTINEL_TOKEN = "00000000-0000-0000-0000-000000000000";

export async function GET() {
  // Rate limit per IP — der Endpoint trifft bei jedem Aufruf die DB und ist
  // unauthentifiziert, ohne Deckel also ein DoS-Verstärker.
  const ip = getClientIp(await headers());
  if (!healthDbRateLimit.check(ip)) {
    return new Response(JSON.stringify({ status: "rate_limited" }), {
      status: 429,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  let db: "ok" | "error" = "ok";
  try {
    // Stateless anon client (cookie/session yok). unstable_cache'li public
    // fetcher'ı KASITLI olarak kullanmıyoruz — o sonucu cache'ler ve sonraki
    // ping'lerde Supabase'e hiç dokunmazdı, keep-alive'ı boşa çıkarırdı.
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await supabase.rpc("get_public_catalog", {
      share_token: SENTINEL_TOKEN,
    });
    // Hata olsa bile istek Supabase'e ulaştıysa aktivite sayılır; sadece
    // gözlemlenebilirlik için işaretliyoruz.
    if (error) db = "error";
  } catch {
    db = "error";
  }

  // Fail-closed für Monitoring: bei DB-Fehler 503 statt 200, sonst sieht der
  // Uptime-Check die DB fälschlich als gesund (OWASP A10:2025).
  return new Response(
    JSON.stringify({
      status: db === "ok" ? "ok" : "degraded",
      db,
      time: new Date().toISOString(),
    }),
    {
      status: db === "ok" ? 200 : 503,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        "pragma": "no-cache",
      },
    },
  );
}
