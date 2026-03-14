/**
 * Vercel serverless API: SEO audit (real checks, 100-point score).
 * POST /api/audit with body { "url": "https://example.com" }
 */
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(200).json({ message: "API running" });
  }

  const emptyResult = (overrides = {}) =>
    res.status(200).json({
      seo_score: 0,
      breakdown: { structure: 0, technical_seo: 0, content_quality: 0 },
      details: {},
      recommendations: [],
      technical_checks_skipped: false,
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
          breakdown: { structure: 0, technical_seo: 0, content_quality: 0 },
          details: {},
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
        breakdown: { structure: 0, technical_seo: 0, content_quality: 0 },
        details: {},
        recommendations: ["Please enter a website URL."],
      });
    }

    url = String(url).trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const signal = controller.signal;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEOAudit/2.0; +https://example.com)",
      },
      redirect: "follow",
      signal,
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

    const finalUrl = response.url || url;
    const origin = getOrigin(finalUrl);
    const html = await response.text();
    const pageSize = typeof html.length === "number" ? html.length : 0;

    const details = analyzePage(html, finalUrl, origin);
    details.page_size_bytes = pageSize;

    const {
      has_robots_txt,
      has_sitemap,
      technical_checks_skipped,
    } = await checkTechnicalUrls(origin);
    details.has_robots_txt = has_robots_txt;
    details.has_sitemap = has_sitemap;
    details.is_https = finalUrl.startsWith("https://");

    const { score: structureScore, recommendations: structureRecs } =
      scoreStructure(details);
    const { score: technicalScore, recommendations: technicalRecs } =
      scoreTechnical(details);
    const { score: contentScore, recommendations: contentRecs } =
      scoreContent(details);

    const seo_score = Math.round(
      structureScore + technicalScore + contentScore
    );
    const recommendations = [
      ...structureRecs,
      ...technicalRecs,
      ...contentRecs,
    ].slice(0, 15);

    return res.status(200).json({
      seo_score: Math.min(100, Math.max(0, seo_score)),
      breakdown: {
        structure: Math.round(structureScore),
        technical_seo: Math.round(technicalScore),
        content_quality: Math.round(contentScore),
      },
      details: sanitizeDetails(details),
      recommendations,
      technical_checks_skipped: technical_checks_skipped || false,
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

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function analyzePage(html, pageUrl, origin) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleRaw = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
  const titleLength = titleRaw ? titleRaw.length : 0;

  const metaDescMatch = html.match(
    /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i
  ) || html.match(
    /<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["']/i
  );
  const metaDescRaw = metaDescMatch ? metaDescMatch[1].trim() : null;
  const metaDescLength = metaDescRaw ? metaDescRaw.length : 0;

  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const h2Count = (html.match(/<h2\b/gi) || []).length;

  const hasCanonical = /<link\s[^>]*rel\s*=\s*["']canonical["'][^>]*>/i.test(html) ||
    /<link\s[^>]*href\s*=[^>]*rel\s*=\s*["']canonical["']/i.test(html);
  const hasViewport = /<meta\s[^>]*name\s*=\s*["']viewport["'][^>]*>/i.test(html);

  const imgTags = html.match(/<img\s[^>]*>/gi) || [];
  const imagesTotal = imgTags.length;
  const imagesWithAlt = imgTags.filter((tag) =>
    /\balt\s*=\s*["'][^"']*["']/i.test(tag) || /\balt\s*=\s*["'][^"']*$/i.test(tag)
  ).length;

  const aTags = html.match(/<a\s[^>]*href\s*=\s*["']([^"']*)["'][^>]*>/gi) || [];
  let internalLinks = 0;
  let externalLinks = 0;
  try {
    const base = new URL(pageUrl);
    for (const tag of aTags) {
      const hrefMatch = tag.match(/href\s*=\s*["']([^"']*)["']/i);
      const href = hrefMatch ? hrefMatch[1].trim() : "";
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
      let absoluteHref;
      try {
        absoluteHref = new URL(href, base).href;
      } catch {
        continue;
      }
      if (origin && new URL(absoluteHref).origin === origin) internalLinks++;
      else externalLinks++;
    }
  } catch (_) {
    internalLinks = 0;
    externalLinks = aTags.length;
  }

  return {
    title: titleRaw || null,
    title_length: titleLength,
    title_present: !!titleRaw,
    meta_description: metaDescRaw || null,
    meta_description_length: metaDescLength,
    meta_description_present: !!metaDescRaw,
    h1_count: h1Count,
    h2_count: h2Count,
    has_canonical: hasCanonical,
    has_viewport: hasViewport,
    images_total: imagesTotal,
    images_with_alt: imagesWithAlt,
    internal_links: internalLinks,
    external_links: externalLinks,
  };
}

async function checkTechnicalUrls(origin) {
  const out = {
    has_robots_txt: false,
    has_sitemap: false,
    technical_checks_skipped: false,
  };
  if (!origin) return out;

  const controller = new AbortController();
  const timeoutMs = 3000;
  const timeoutId = setTimeout(() => {
    controller.abort();
    out.technical_checks_skipped = true;
  }, timeoutMs);
  const signal = controller.signal;
  const headers = { "User-Agent": "Mozilla/5.0 (compatible; SEOAudit/2.0)" };

  const robotsPromise = fetch(origin + "/robots.txt", { signal, headers })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  const sitemapPromise = fetch(origin + "/sitemap.xml", { signal, headers })
    .then((r) => r.ok)
    .catch(() => false);

  try {
    const [robotsSettled, sitemapSettled] = await Promise.allSettled([
      robotsPromise,
      sitemapPromise,
    ]);
    clearTimeout(timeoutId);

    const robotsText =
      robotsSettled.status === "fulfilled" ? robotsSettled.value : "";
    const sitemapOk =
      sitemapSettled.status === "fulfilled" ? sitemapSettled.value : false;

    out.has_robots_txt = typeof robotsText === "string" && robotsText.length > 0;
    out.has_sitemap =
      sitemapOk ||
      (typeof robotsText === "string" &&
        /sitemap\s*:\s*https?:\/\//i.test(robotsText));
  } catch (_) {
    clearTimeout(timeoutId);
    out.technical_checks_skipped = true;
  }

  return out;
}

function scoreStructure(d) {
  let score = 0;
  const recs = [];
  if (d.title_present) {
    score += 5;
    if (d.title_length >= 30 && d.title_length <= 60) score += 5;
    else if (d.title_length > 0) score += 2;
    if (d.title_length > 60) recs.push("Shorten your title tag (ideal 30–60 characters).");
    if (d.title_length > 0 && d.title_length < 30) recs.push("Consider a longer title (30–60 characters is ideal).");
  } else recs.push("Add a title tag.");
  if (d.meta_description_present) {
    score += 5;
    if (d.meta_description_length >= 120 && d.meta_description_length <= 160) score += 5;
    else if (d.meta_description_length > 0) score += 2;
    if (d.meta_description_length > 160) recs.push("Shorten meta description (ideal 120–160 characters).");
    if (d.meta_description_length > 0 && d.meta_description_length < 120) recs.push("Consider a longer meta description (120–160 characters).");
  } else recs.push("Add a meta description.");
  if (d.h1_count === 1) score += 5;
  else if (d.h1_count > 1) {
    score += 2;
    recs.push(`Use exactly one H1 tag (found ${d.h1_count}).`);
  } else recs.push("Use exactly one H1 tag.");
  if (d.h2_count >= 1) score += 3;
  else if (d.h1_count >= 1) score += 1;
  return { score: Math.min(30, score), recommendations: recs };
}

function scoreContent(d) {
  let score = 0;
  const recs = [];
  if (d.images_total > 0) {
    const ratio = d.images_with_alt / d.images_total;
    score += Math.round(10 * ratio);
    if (ratio < 1) recs.push(`Your page has ${d.images_total} image(s) but only ${d.images_with_alt} have alt attributes.`);
  } else score += 10;
  const internal = d.internal_links || 0;
  if (internal >= 3) score += 10;
  else if (internal >= 1) score += 6;
  else recs.push("Add internal links to other pages on your site.");
  let contentSignals = 0;
  if (d.external_links > 0) contentSignals += 8;
  if (d.h2_count >= 2) contentSignals += 8;
  if (d.page_size_bytes > 500) contentSignals += 6;
  if (d.meta_description_present && d.title_present) contentSignals += 8;
  score += Math.min(30, contentSignals);
  return { score: Math.min(50, score), recommendations: recs };
}

function scoreTechnical(d) {
  let score = 0;
  const recs = [];
  const pts = { robots: 4, sitemap: 4, https: 4, canonical: 4, viewport: 4 };
  if (d.has_robots_txt) score += pts.robots; else recs.push("Add a robots.txt file.");
  if (d.has_sitemap) score += pts.sitemap; else recs.push("Add a sitemap (e.g. sitemap.xml).");
  if (d.is_https) score += pts.https; else recs.push("Use HTTPS for this page.");
  if (d.has_canonical) score += pts.canonical; else recs.push("Add a canonical tag.");
  if (d.has_viewport) score += pts.viewport; else recs.push("Add a viewport meta tag for mobile.");
  return { score: Math.min(20, score), recommendations: recs };
}


function sanitizeDetails(d) {
  return {
    title: d.title || "—",
    title_length: d.title_length,
    title_present: d.title_present,
    meta_description_length: d.meta_description_length,
    meta_description_present: d.meta_description_present,
    h1_count: d.h1_count,
    h2_count: d.h2_count,
    has_canonical: d.has_canonical,
    has_viewport: d.has_viewport,
    has_robots_txt: d.has_robots_txt,
    has_sitemap: d.has_sitemap,
    is_https: d.is_https,
    images_total: d.images_total,
    images_with_alt: d.images_with_alt,
    internal_links: d.internal_links,
    external_links: d.external_links,
    page_size_bytes: d.page_size_bytes,
  };
}
