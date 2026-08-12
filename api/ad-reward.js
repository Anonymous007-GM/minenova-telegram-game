const { createClient } = require("@supabase/supabase-js");

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const {
  ymid,
  telegram_id,
  event_type,
  reward_event_type,
  estimated_price,
  zone_id,
  request_var,
  secret
} = req.query;

    // Secret configured only in Monetag postback URL
    if (!secret || secret !== process.env.MONETAG_POSTBACK_SECRET) {
      return res.status(403).send("Forbidden");
    }

    // Only accept our Monetag zone
    if (String(zone_id) !== "11559295") {
      return res.status(400).send("Invalid zone");
    }

    if (!ymid || !telegram_id) {
      return res.status(400).send("Missing user data");
    }

    // Only reward monetized events
if (
  reward_event_type !== "valued" &&
  reward_event_type !== "yes"
) {
  return res.status(200).send("Event not valued");
}

    // Reward only confirmed impressions
    if (event_type !== "impression") {
      return res.status(200).send("Event ignored");
    }

    // Check whether this ad event was already rewarded
    const { data: existing, error: existingError } = await db
      .from("ad_rewards")
      .select("id")
      .eq("ymid", String(ymid))
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return res.status(200).send("Already rewarded");
    }

    const userId = String(telegram_id);

    // Make sure player exists
    const { data: player, error: playerError } = await db
      .from("players")
      .select("id,balance")
      .eq("id", userId)
      .single();

    if (playerError || !player) {
      return res.status(404).send("Player not found");
    }

    const reward = 100;
    const newBalance = Number(player.balance || 0) + reward;

    // Update balance
    const { error: updateError } = await db
      .from("players")
      .update({
        balance: newBalance
      })
      .eq("id", userId);

    if (updateError) throw updateError;

    // Record rewarded event
    const { error: rewardError } = await db
      .from("ad_rewards")
      .insert({
        ymid: String(ymid),
        telegram_id: Number(telegram_id),
        reward,
        reward_event_type,
        estimated_price: Number(estimated_price || 0)
      });

    if (rewardError) throw rewardError;

    return res.status(200).json({
      success: true,
      reward
    });

  } catch (error) {
    console.error("Monetag reward error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
};
