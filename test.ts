import { GoogleGenAI } from "@google/genai";

async function test() {
  const r = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({textToSubmit: "hello"})
  });
  console.log(r.status);
  console.log(r.headers.get("content-type"));
  const text = await r.text();
  console.log(text.slice(0, 100));
}
test();
