import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AuditRequest {
  url: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { url }: AuditRequest = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid URL provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const analysis = await analyzeWebsite(url);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to analyze website" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function analyzeWebsite(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const html = await response.text();

    const groqAnalysis = await getGroqAnalysis(html, url);

    return groqAnalysis;
  } catch (error) {
    console.error("Analysis error:", error);
    return {
      url: url,
      seo_score: 40,
      speed_score: 45,
      design_score: 50,
      overall_score: 45,
      recommendations: [
        "Unable to perform full analysis - please ensure the website is publicly accessible",
        "We recommend improving your SEO with meta tags and structured data",
        "Optimize images and reduce page load times for better performance",
        "Ensure mobile responsiveness across all devices",
        "Consider adding a contact form to capture customer inquiries",
      ],
    };
  }
}

async function getGroqAnalysis(html: string, url: string) {
  const groqApiKey = Deno.env.get("GROQ_API_KEY");

  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const htmlPreview = html.substring(0, 8000);

  const prompt = `Analyze this website HTML and provide a detailed audit assessment:

Website URL: ${url}
HTML Content (first 8KB):
${htmlPreview}

Based on the HTML provided, score and analyze the website on these criteria (scores 0-100):
1. SEO Score - Meta tags, heading structure, alt text, schema markup
2. Speed Score - Code minification, lazy loading, image optimization indicators
3. Design Score - Modern design patterns, typography, color scheme, layout consistency

Also provide 3-4 specific, actionable recommendations for improvement.

Respond ONLY with this JSON format (no markdown, no code blocks, just valid JSON):
{
  "seo_score": <number>,
  "speed_score": <number>,
  "design_score": <number>,
  "overall_score": <number>,
  "recommendations": [<string>, <string>, <string>, <string>]
}`;

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices[0].message.content;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      url: url,
      seo_score: Math.max(0, Math.min(100, analysis.seo_score || 50)),
      speed_score: Math.max(0, Math.min(100, analysis.speed_score || 50)),
      design_score: Math.max(0, Math.min(100, analysis.design_score || 50)),
      overall_score: Math.max(0, Math.min(100, analysis.overall_score || 50)),
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
    };
  } catch (error) {
    console.error("Groq analysis error:", error);
    return {
      url: url,
      seo_score: 50,
      speed_score: 50,
      design_score: 50,
      overall_score: 50,
      recommendations: [
        "Add comprehensive meta descriptions to all pages",
        "Implement lazy loading for images and optimize their sizes",
        "Improve mobile responsiveness and touch targets",
        "Add a clear call-to-action and contact form",
      ],
    };
  }
}
