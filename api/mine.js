const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function verify(initData) {
  const p = new URLSearchParams(initData || "");
  const hash = p.get("hash");

  if (!hash) throw new Error("Missing Telegram hash");

  p.delete("hash");

  const check = [...p.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const calculated = crypto
    .createHmac("sha256", secret)
    .update(check)
    .digest("hex");

  const a = Buffer.from(calculated, "hex");
  const b = Buffer.from(hash, "hex");

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid Telegram signature");
  }

  const authDate = Number(p.get("auth_date") || 0);

  if (!authDate || Math.floor(Date.now() / 1000) - authDate > 86400) {
    throw new Error("Telegram data expired");
  }

  const user = JSON.parse(p.get("user") || "{}");

  if (!user.id) {
    throw new Error("Telegram user missing");
  }

  return user;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const user = verify(
      req.headers["x-telegram-init-data"]
    );

    const { data, error } = await db.rpc(
      "mine_player",
      {
        p_player_id: user.id
      }
    );

    if (error) throw error;

    res.status(200).json({
      player: data
    });

  } catch (e) {
    console.error(e);

    res.status(400).json({
      error: e.message || "Mining failed"
    });
  }
};
