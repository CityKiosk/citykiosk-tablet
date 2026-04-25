// Health check endpoint for uptime pings (cron-job.org, UptimeRobot, etc.)
// Guaranteed NOT cached — forces Render's Node.js server to process every request,
// which resets the free tier spin-down timer.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      time: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        "pragma": "no-cache",
      },
    }
  );
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
