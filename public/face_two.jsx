import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic } from "lucide-react";

export default function ProblemSolverChatBot() {
  const [messages, setMessages] = useState([
    {
      role: "system",
      content:
        "You are an intelligent, task-oriented AI assistant designed to solve problems, offer step-by-step reasoning, and guide users toward clear, practical solutions.",
    },
    {
      role: "assistant",
      content:
        "🧠 Hi! I'm your AI problem solver. Tell me what you're stuck on — coding issues, logic problems, math doubts, or anything technical. Let's solve it together!",
    },
  ]);
  const [input, setInput] = useState("");
  const chatBoxRef = useRef(null);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const speak = (text) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1;
    synth.speak(utterance);
  };

  const addMessage = (role, content) => {
    setMessages((prev) => [...prev, { role, content }]);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage("assistant", "⚠️ Your browser does not support voice recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSubmit(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Voice recognition error:", event.error);
      addMessage("assistant", "🎤 Voice recognition error: " + event.error);
    };
  };

  const handleSubmit = async (userInput) => {
    const inputToSend = userInput || input.trim();
    if (!inputToSend) return;

    addMessage("user", inputToSend);
    setInput("");

    try {
      const cmdRes = await fetch("http://localhost:3000/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: inputToSend }),
      });
      const cmdResult = await cmdRes.json();

      if (!cmdResult.message.includes("Unknown")) {
        addMessage("assistant", cmdResult.message);
        speak(cmdResult.message);
        return;
      }
    } catch (err) {
      console.error("Command Error:", err);
    }

    try {
      const chatRes = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta-llama/llama-3-70b-instruct",
          messages,
        }),
      });
      const data = await chatRes.json();
      const reply =
        data.choices?.[0]?.message?.content ||
        "Sorry, I couldn't fetch a response.";
      addMessage("assistant", reply);
      speak(reply);
    } catch (err) {
      console.error("Error:", err);
      addMessage(
        "assistant",
        "⚠️ Something went wrong. Please check your server or connection."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-white flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl backdrop-blur-md bg-white/60 border shadow-2xl rounded-3xl">
        <CardContent className="p-6">
          <h1 className="text-4xl font-extrabold text-center text-indigo-700 mb-6">
            🧠 Problem Solver ChatBot
          </h1>

          <div
            ref={chatBoxRef}
            className="h-[28rem] overflow-y-auto space-y-4 px-3 py-4 bg-white rounded-xl border border-gray-300 shadow-inner"
          >
            {messages.slice(1).map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-xl shadow text-base ${
                    msg.role === "assistant"
                      ? "bg-indigo-100 text-indigo-900"
                      : "bg-indigo-600 text-white"
                  }`}
                >
                  <strong>
                    {msg.role === "assistant" ? "ChatBot" : "You"}:
                  </strong>
                  <br />
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          <form
            className="flex mt-4 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <Input
              placeholder="Describe your problem..."
              className="flex-grow"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              required
            />
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
              Send
            </Button>
            <Button type="button" variant="secondary" onClick={handleVoiceInput}>
              <Mic className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}