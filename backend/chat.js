import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
console.log("CWD:", process.cwd());
console.log("Using API key:", process.env.HF_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model } = req.body;

    const response = await fetch('https://router.huggingface.co/fireworks-ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messages,
        model: model,
        stream: false
      })
    });

    const data = await response.json();
    // The response format should match what your frontend expects
    res.json(data);
  } catch (err) {
    console.error("API call failed:", err);
    res.status(500).json({ error: 'API call failed' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));