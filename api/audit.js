export default async function handler(req, res) {

try {

if (req.method !== "POST") {
return res.status(200).json({ message: "API running" })
}

const { url } = req.body || {}

if (!url) {
return res.status(400).json({ error: "Missing URL" })
}

const response = await fetch(url, {
headers: {
"User-Agent": "Mozilla/5.0"
}
})

const html = await response.text()

// simple SEO checks
const hasTitle = html.includes("<title")
const hasMeta = html.includes('name="description"')
const h1Count = (html.match(/<h1/gi) || []).length

let seo = 0
let speed = 70
let design = 70

if (hasTitle) seo += 30
if (hasMeta) seo += 30
if (h1Count === 1) seo += 40
if (seo > 100) seo = 100

const overall = Math.round((seo + speed + design) / 3)

return res.status(200).json({
seo_score: seo,
speed_score: speed,
design_score: design,
overall_score: overall,
recommendations: [
"Add meta description",
"Improve heading structure",
"Optimize images"
]
})

} catch (err) {

console.error(err)

return res.status(200).json({
seo_score: 50,
speed_score: 60,
design_score: 60,
overall_score: 57,
recommendations: [
"Website blocked automated request",
"Check SEO structure",
"Try another website"
]
})

}

}
