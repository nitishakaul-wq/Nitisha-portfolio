export default async function handler(req,res){

if(req.method!=="POST"){
return res.status(405).json({error:"Method not allowed"})
}

try{

const {url}=req.body

if(!url){
return res.status(400).json({error:"No URL provided"})
}

const response=await fetch(url)
const html=await response.text()

// -------- BASIC CHECKS --------

const titleMatch=html.match(/<title>(.*?)</title>/i)
const metaDescMatch=html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^%22]*)["']/i)

const h1Matches=[...html.matchAll(/<h1[^>]*>(.*?)</h1>/gi)]
const imgMatches=[...html.matchAll(/<img[^>]*>/gi)]

const altMatches=[...html.matchAll(/alt=["'](.*?)["']/gi)]

const linkMatches=[...html.matchAll(/<a\s+(?:[^>]*?\s+)?href=["'](.*?)["']/gi)]

// -------- SCORES --------

let seoScore=0
let speedScore=70
let designScore=70

// Title check
if(titleMatch){
const titleLength=titleMatch[1].length
if(titleLength>10 && titleLength<60){
seoScore+=20
}else{
seoScore+=10
}
}

// Meta description
if(metaDescMatch){
seoScore+=20
}

// H1 usage
if(h1Matches.length===1){
seoScore+=20
}else if(h1Matches.length>1){
seoScore+=10
}

// Image alt tags
if(imgMatches.length>0){
const altRatio=altMatches.length/imgMatches.length
seoScore+=Math.round(altRatio*20)
}

// Internal links
if(linkMatches.length>5){
seoScore+=10
}

// HTTPS
if(url.startsWith("https")){
seoScore+=10
}

// Content length
const textContent=html.replace(/<[^>]*>/g,"")
if(textContent.length>2000){
seoScore+=10
}

if(seoScore>100){
seoScore=100
}

// Overall score
const overallScore=Math.round((seoScore+speedScore+designScore)/3)

// -------- AI RECOMMENDATIONS --------

const snippet=textContent.slice(0,2000)

let recommendations=[
"Add meta description",
"Improve heading structure",
"Optimize images with alt tags"
]

try{

const ai=await fetch("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${process.env.GROQ_API_KEY}`
},
body:JSON.stringify({
model:"llama3-70b-8192",
messages:[
{
role:"system",
content:"You are an SEO expert. Return JSON with recommendations array only."
},
{
role:"user",
content:`Analyze this website content and suggest SEO improvements:\n\n${snippet}`
}
]
})
})

const aiData=await ai.json()

const aiText=aiData.choices?.[0]?.message?.content

const parsed=JSON.parse(aiText)

if(parsed.recommendations){
recommendations=parsed.recommendations
}

}catch(e){
// fallback
}

return res.status(200).json({
seo_score:seoScore,
speed_score:speedScore,
design_score:designScore,
overall_score:overallScore,
recommendations
})

}catch(err){

return res.status(500).json({error:"Audit failed"})

}
}
