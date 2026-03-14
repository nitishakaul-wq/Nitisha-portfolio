/**
 * Vercel serverless API: SEO audit.
 * POST /api/audit with body { "url": "https://example.com" }
 * Always returns JSON; never throws.
 */
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(200).json({ message: "API running" });
  }

  const emptyResult = (overrides = {}) =>
    res.status(200).json({
      seo_score: 0,
      title: "—",
      h1_count: 0,
      recommendations: [],
      ...overrides,
    });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body || "{}");
      } catch {
        return res.status(400).json({
          error: "Invalid JSON",
          seo_score: 0,
          title: "—",
          h1_count: 0,
          recommendations: ["Send a valid JSON body with a 'url' field."],
        });
      }
    }
    body = body || {};

    let { url } = body;
    if (url == null || String(url).trim() === "") {
      return res.status(400).json({
        error: "URL required",
        seo_score: 0,
        title: "—",
        h1_count: 0,
        recommendations: ["Please enter a website URL."],
      });
    }

    url = String(url).trim();
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEOAudit/1.0; +https://example.com)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return emptyResult({
        seo_score: 50,
        recommendations: [
          `Server returned ${response.status}. Try another website.`,
        ],
      });
    }

    const html = await response.text();

    const titleMatch = html.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
    const hasMetaDesc =
      /<meta\s[^>]*name\s*=\s*["']description["'][^>]*>/i.test(html) ||
      /<meta\s[^>]*content\s*=[^>]*name\s*=\s*["']description["']/i.test(html);
    const h1Count = (html.match(/<h1\b/gi) || []).length;

    let score = 0;
    if (title) score += 40;
    if (hasMetaDesc) score += 30;
    if (h1Count === 1) score += 30;

    const recommendations = [];
    if (!title) recommendations.push("Add a title tag");
    if (!hasMetaDesc) recommendations.push("Add a meta description");
    if (h1Count !== 1)
      recommendations.push(
        h1Count === 0
          ? "Use exactly one H1 tag"
          : `Use exactly one H1 tag (found ${h1Count})`
      );

    return res.status(200).json({
      seo_score: score,
      title: title || "Missing",
      h1_count: h1Count,
      recommendations,
    });
  } catch (error) {
    console.error("Audit error:", error);
    const message =
      error.name === "AbortError"
        ? "Request timed out. Try another website."
        : "Website could not be fetched. Try another URL.";
    return emptyResult({
      seo_score: 50,
      recommendations: [message],
    });
  }
}
