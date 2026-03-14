/**
 * Vercel serverless API: AI-generated mock preview from business description.
 * POST /api/mock-preview with body { "businessName": "...", "message": "..." }
 * Returns { tagline, sections } for the live mock. Uses GROQ_API_KEY (optional).
 */
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(200).json({ tagline: null, sections: null });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }
  body = body || {};

  const businessName = (body.businessName || "").trim();
  const message = (body.message || "").trim();

  if (!message && !businessName) {
    return res.status(200).json({
      tagline: "Your tagline will appear here.",
      sections: ["Home", "Services", "About", "Contact"],
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      tagline: null,
      sections: null,
    });
  }

  const prompt = `You are helping generate a short, friendly preview for a small business website mockup.

Business name: ${businessName || "(not given)"}
Description from the owner: ${message || "(none)"}

Reply with JSON only, no other text. Use this exact structure:
{"tagline": "One short, catchy line (max 12 words) for the business hero.", "sections": ["Section1", "Section2", "Section3"]}

Rules:
- tagline: One sentence, inviting and professional. No quotes inside. Max 12 words.
- sections: Exactly 3 or 4 short navigation-style names (e.g. "Our Menu", "About Us", "Find Us", "Contact"). Use title case.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq error:", response.status, err);
      return res.status(200).json({ tagline: null, sections: null });
    }

    const data = await response.json();
    const content =
      data.choices?.[0]?.message?.content?.trim() || "";
    let tagline = null;
    let sections = null;

    try {
      const parsed = JSON.parse(content);
      if (parsed.tagline && typeof parsed.tagline === "string") {
        tagline = parsed.tagline.slice(0, 80);
      }
      if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        sections = parsed.sections.slice(0, 5).map((s) => String(s).slice(0, 24));
      }
    } catch (_) {
      // fallback: try to extract tagline from first line
      const firstLine = content.split("\n")[0].replace(/^["']|["']$/g, "").trim();
      if (firstLine.length > 0 && firstLine.length < 100) tagline = firstLine;
    }

    return res.status(200).json({
      tagline: tagline || null,
      sections: sections || null,
    });
  } catch (error) {
    console.error("mock-preview error:", error);
    return res.status(200).json({ tagline: null, sections: null });
  }
}
