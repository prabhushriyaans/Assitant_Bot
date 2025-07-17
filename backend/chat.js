import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 AI Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model } = req.body;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || "deepseek/deepseek-r1:free",
        messages
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("API call failed:", err);
    res.status(500).json({ error: 'API call failed' });
  }
});

// 🔹 Command & WhatsApp Desktop Messaging Endpoint
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

  // ✅ --- CONTACT MEMORY SECTION ---
  const contactsPath = path.join('./contacts.json');

  function loadContacts() {
    if (!fs.existsSync(contactsPath)) fs.writeFileSync(contactsPath, '{}');
    return JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
  }

  function saveContacts(contacts) {
    fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
  }

  // 🔸 Match: "send the text message 'hi' to number +91..."
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

  // 🔸 Match: "call +919876543210" or "open +919..."
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

  // 🔹 NEW: Match "call ravi +91..." — learn contact
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

  // 🔹 Match "call ravi" — use stored contact
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

  // 🔹 NEW: Match "remove ravi" — delete stored contact
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

  // 🔹 Fallback
  res.json({ message: "❌ Unknown command." });
});

// 🔹 Start Server
app.listen(3000, () => console.log('🚀 Server running on port 3000'));
