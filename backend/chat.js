import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
// import Mercury from '@postlight/parser'; // Not used in the provided code, consider removing if not needed.

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ===========================
   🔹 AI Chat Endpoint
   =========================== */
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model: rawModel } = req.body; // Capture the raw model string
    const model = rawModel ? rawModel.trim() : ''; // Trim any whitespace

    console.log(`[DEBUG] Raw model string received: "${rawModel}"`);
    console.log(`[DEBUG] Trimmed model string: "${model}"`);
    console.log(`[DEBUG] Does trimmed model start with "google/"? ${model.startsWith("google/")}`);
    console.log(`[DEBUG] Does trimmed model start with "deepseek/"? ${model.startsWith("deepseek/")}`);


    let apiUrl, headers, body;

    // Determine which AI model to use based on the 'model' parameter from the frontend
    if (model.startsWith("google/")) {
        console.log(`[DEBUG] Routing to Google Gemini API for model: ${model}`);
        const geminiModel = model.replace("google/", ""); // Extracts model name like 'gemini-2.0-flash'

        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        headers = {
            'Content-Type': 'application/json'
        };

        const geminiContents = [];
        let systemPrompt = "";

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt = msg.content;
            } else if (msg.role === 'user') {
                if (systemPrompt && geminiContents.length === 0) {
                    geminiContents.push({
                        role: 'user',
                        parts: [{ text: systemPrompt + "\n\n" + msg.content }]
                    });
                    systemPrompt = "";
                } else {
                    geminiContents.push({
                        role: 'user',
                        parts: [{ text: msg.content }]
                    });
                }
            } else if (msg.role === 'assistant') {
                geminiContents.push({
                    role: 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }

        body = JSON.stringify({
            contents: geminiContents
        });
    }
    else if (model.startsWith("deepseek/")) {
      console.log(`[DEBUG] Routing to DeepSeek (OpenRouter) API for model: ${model}`);
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json'
      };
      body = JSON.stringify({
        model: model, // Use the exact model string from the frontend
        messages
      });
    }
    else {
      console.warn(`[DEBUG] Unexpected model received: "${model}". Defaulting to DeepSeek.`);
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json'
      };
      body = JSON.stringify({
        model: "deepseek/deepseek-r1:free", // Explicitly set fallback model
        messages
      });
    }

    const response = await fetch(apiUrl, { method: 'POST', headers, body });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText || 'Unknown error during API call' }));
        console.error("API call failed with status:", response.status, "Error details:", errorData);
        return res.status(response.status).json({ error: `API call failed: ${errorData.error?.message || errorData.message || JSON.stringify(errorData)}` });
    }

    const data = await response.json();

    if (model.startsWith("google/")) {
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
            res.json({ choices: [{ message: { content: data.candidates[0].content.parts[0].text } }] });
        } else {
            console.error("Invalid Gemini API response format or no candidates in response:", data);
            res.status(500).json({ error: 'Invalid Gemini API response format or no response from model.', details: data });
        }
    } else {
        res.json(data);
    }
  } catch (err) {
    console.error("Caught an exception during API call:", err);
    res.status(500).json({ error: 'API call failed due to server error.' });
  }
});


/* ===========================
   🔹 Enhanced News API Endpoint
   =========================== */
app.get('/api/news', async (req, res) => {
  const { type } = req.query;

  const endpoints = {
    tesla: `https://newsapi.org/v2/everything?q=tesla&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`,
    apple: `https://newsapi.org/v2/everything?q=apple&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`,
    business: `https://newsapi.org/v2/top-headlines?country=us&category=business&apiKey=${process.env.NEWS_API_KEY}`,
    techcrunch: `https://newsapi.org/v2/top-headlines?sources=techcrunch&apiKey=${process.env.NEWS_API_KEY}`,
    wsj: `https://newsapi.org/v2/everything?domains=wsj.com&apiKey=${process.env.NEWS_API_KEY}`,
    football: `https://newsapi.org/v2/everything?q=football&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`,
    sports: `https://newsapi.org/v2/top-headlines?category=sports&country=us&apiKey=${process.env.NEWS_API_KEY}`,
    education: `https://newsapi.org/v2/everything?q=education&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`,
    culturalfest: `https://newsapi.org/v2/everything?q=cultural%20fest&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`,
    science: `https://newsapi.org/v2/top-headlines?category=science&country=us&apiKey=${process.env.NEWS_API_KEY}`,
    health: `https://newsapi.org/v2/top-headlines?category=health&country=us&apiKey=${process.env.NEWS_API_KEY}`,
    entertainment: `https://newsapi.org/v2/top-headlines?category=entertainment&country=us&apiKey=${process.env.NEWS_API_KEY}`,
    technology: `https://newsapi.org/v2/top-headlines?category=technology&country=us&apiKey=${process.env.NEWS_API_KEY}`,
    general: `https://newsapi.org/v2/top-headlines?country=us&apiKey=${process.env.NEWS_API_KEY}`
  };

  const url = type && endpoints[type.toLowerCase()] ? endpoints[type.toLowerCase()] : endpoints.general;

  try {
    const newsRes = await fetch(url);
    const newsData = await newsRes.json();

    if (!newsData.articles || newsData.articles.length === 0) {
      return res.json({ message: `📰 No ${type || 'general'} news found at the moment.` });
    }

    const topArticles = newsData.articles.slice(0, 3).map((a, i) => {
      return `🔹 ${i + 1}. ${a.title}\n🗞️ ${a.source.name}\n🔗 ${a.url}`;
    }).join('\n\n');

    res.json({ message: `📰 Here are the latest ${type || 'general'} news articles:\n\n${topArticles}` });
  } catch (err) {
    console.error(`News fetch failed for ${type}:`, err);
    res.status(500).json({ message: `⚠️ Failed to fetch ${type || 'general'} news.` });
  }
});

/* ===========================
   🔹 Current Facts API Endpoint
   =========================== */
app.get('/api/currentfacts', async (req, res) => {
  const { topic } = req.query;

  // Simulate current facts, date-sensitive responses would require external APIs
  if (topic === 'us_president') {
    return res.json({
      message: "🇺🇸 As of July 2025, the President of the United States is Joe Biden."
    });
  }

  if (topic === 'india_pm') {
    return res.json({
      message: "🇮🇳 As of July 2025, the Prime Minister of India is Narendra Modi."
    });
  }

  return res.json({ message: `⚠️ No data available for "${topic}".` });
});

/* ===========================
   🔹 Command Endpoint
   =========================== */
app.post('/api/command', (req, res) => {
  const { query } = req.body;
  const lower = query.toLowerCase();

  const commands = {
    "open notepad": "notepad",
    "close notepad": "taskkill /IM notepad.exe /F",
    "open calculator": "calc",
    "close calculator": "taskkill /IM calculator.exe /F",
    "open file explorer": "explorer.exe shell:MyComputerFolder",
    "close file explorer": "taskkill /IM explorer.exe /F",
    "open chrome": "start chrome",
    "close chrome": "taskkill /IM chrome.exe /F",
    "open chatgpt": "start \"\" \"C:\\Users\\Shriyaans\\AppData\\Local\\Programs\\ChatGPT\\ChatGPT.exe\"",
    "close chatgpt": "taskkill /IM ChatGPT.exe /F",
    "open downloads": "explorer.exe C:\\Users\\Shriyaans\\Downloads",
    "open documents": "explorer.exe C:\\Users\\Shriyaans\\Documents",
    "open desktop": "explorer.exe C:\\Users\\Shriyaans\\Desktop",
    "lock screen": "rundll32.exe user32.dll,LockWorkStation",
    "shutdown": "shutdown /s /t 1",
    "restart": "shutdown /r /t 1",
    "turn off wifi": "netsh interface set interface name=\"Wi-Fi\" admin=disabled",
    "turn on wifi": "netsh interface set interface name=\"Wi-Fi\" admin=enabled",
    "volume up": "nircmd.exe changesysvolume 5000",
    "volume down": "nircmd.exe changesysvolume -5000",
    "open pycharm": "\"C:\\Program Files\\JetBrains\\PyCharm 2023.2.1\\bin\\pycharm64.exe\"",
    "open whatsapp": "start whatsapp://",
    "open camera": "start microsoft.windows.camera:",
    "close camera": "taskkill /IM WindowsCamera.exe /F"
  };

  for (const key in commands) {
    if (lower.includes(key)) {
      exec(commands[key], (error) => {
        if (error) return res.json({ message: "❌ Command failed: " + error.message });
        return res.json({ message: "✅ Executed: " + key });
      });
      return;
    }
  }

  const contactsPath = path.join('./contacts.json');

  function loadContacts() {
    if (!fs.existsSync(contactsPath)) fs.writeFileSync(contactsPath, '{}');
    return JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
  }

  function saveContacts(contacts) {
    fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
  }

  const sendMsgMatch = lower.match(/send\s+the\s+text\s+message\s+"([^"]+)"\s+to\s+number\s+((?:\+?\d[\d\s\-().]*){10,})/i);
  if (sendMsgMatch) {
    const message = encodeURIComponent(sendMsgMatch[1].trim());
    let number = sendMsgMatch[2].replace(/\D/g, '');
    if (number.length < 10) {
      return res.json({ message: `❌ Invalid phone number format.` });
    }
    const whatsappURL = `whatsapp://send?phone=${number}&text=${message}`;
    const command = `start "" "${whatsappURL}"`;
    exec(command, (error) => {
      if (error) {
        return res.json({ message: `❌ Could not open WhatsApp for ${number}` });
      }
      return res.json({
        message: `✅ Message ready to send to ${number}: "${decodeURIComponent(message)}".`
      });
    });
    return;
  }

  const phoneMatch = lower.match(/(?:^|\s)(?:open|call)\s+((?:\+?\d[\d\s\-().]*){10,})/i);
  if (phoneMatch) {
    let number = phoneMatch[1].replace(/\D/g, '');
    if (number.length < 10) {
      return res.json({ message: `❌ Invalid phone number format.` });
    }
    const whatsappURL = `whatsapp://send?phone=${number}`;
    const command = `start "" "${whatsappURL}"`;
    exec(command, (error) => {
      if (error) {
        return res.json({ message: `❌ Could not open WhatsApp for ${number}` });
      }
      return res.json({
        message: `📞 WhatsApp chat opened for ${number}.`
      });
    });
    return;
  }

  const learnMatch = lower.match(/(?:call|message)\s+(\w+)\s+(\+91\d{10})/i);
  if (learnMatch) {
    const [, name, number] = learnMatch;
    const contacts = loadContacts();
    contacts[name.toLowerCase()] = number;
    saveContacts(contacts);

    const whatsappURL = `whatsapp://send?phone=${number}`;
    const command = `start "" "${whatsappURL}"`;
    exec(command, (error) => {
      if (error) {
        return res.json({ message: `❌ Could not open WhatsApp for ${name}` });
      }
      return res.json({
        message: `✅ Saved ${name} and opened WhatsApp for ${number}.`
      });
    });
    return;
  }

  const recallMatch = lower.match(/(?:call|message)\s+(\w+)/i);
  if (recallMatch) {
    const [, name] = recallMatch;
    const contacts = loadContacts();
    const number = contacts[name.toLowerCase()];
    if (number) {
      const whatsappURL = `whatsapp://send?phone=${number}`;
      const command = `start "" "${whatsappURL}"`;
      exec(command, (error) => {
        if (error) {
          return res.json({ message: `❌ Could not open WhatsApp for ${name}` });
        }
        return res.json({
          message: `📞 WhatsApp chat opened for ${name} at ${number}.`
        });
      });
    } else {
      return res.json({
        message: `🤖 I don't have a number saved for ${name}. Please teach me using: "call ${name} +91..." `
      });
    }
    return;
  }

  const removeMatch = lower.match(/remove\s+(\w+)/i);
  if (removeMatch) {
    const name = removeMatch[1].toLowerCase();
    const contacts = loadContacts();
    if (contacts[name]) {
      delete contacts[name];
      saveContacts(contacts);
      return res.json({ message: `🗑️ Removed contact: ${name}` });
    } else {
      return res.json({ message: `⚠️ No contact found for ${name}` });
    }
  }

  res.json({ message: "❌ Unknown command." });
});

/* ===========================
   🔹 Start Server
   =========================== */
app.listen(3000, () => console.log('🚀 Server running on port 3000'));