import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data } = await supabase
    .from("products")
    .select("id, name_de, dimensions")
    .not("dimensions", "is", null)
    .order("dimensions");

  const unique = [...new Set((data ?? []).map(p => p.dimensions))];
  console.log(`Unique dimensions (${unique.length}):`);
  unique.forEach(d => console.log(`  "${d}"`));
}
main();
