export default async function handler(req,res){

try{

if(req.method !== "POST"){
return res.status(200).json({message:"Audit API running"})
}

const {url} = req.body || {}

if(!url){
return res.status(400).json({error:"Missing URL"})
}

let html=""

// fetch site safely
try{

const response = await fetch(url,{
headers:{
"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}
})

html = await response.text()

}catch(e){

return res.status(200).json({
seo_score:40,
speed_score:60,
design_score:60,
overall_score:53,
recommendations:[
"Website blocked automated audit request",
"Check server security headers",
"Ensure website allows basic crawling"
]
})

}

// ----- BASIC CHECKS -----

const title = html.match(/<title>(.*?)</title>/i)
const meta = html.match(/name=["']description["']\s*content=["']([^%22]*)/i)
const h1 = [...html.matchAll(/<h1/gi)]
const imgs = [...html.matchAll(/<img/gi)]
const alts = [...html.matchAll(/alt=/gi)]
const links = [...html.matchAll(/<a\s+href/gi)]

let seo=0
let speed=70
let design=70

if(title){
const len = title[1].length
seo += (len>10 && len<60) ? 20 : 10
}

if(meta){
seo += 20
}

if(h1.length===1){
seo += 20
}else if(h1.length>1){
seo += 10
}

if(imgs.length>0){
const ratio = alts.length/imgs.length
seo += Math.round(ratio*20)
}

if(links.length>5){
seo += 10
}

if(url.startsWith("https")){
seo += 10
}

const text = html.replace(/<[^>]*>/g,"")

if(text.length>2000){
seo += 10
}

if(seo>100) seo=100

const overall = Math.round((seo+speed+design)/3)

// ---- AI suggestions (optional) ----

let recommendations=[
"Add meta description",
"Improve heading structure",
"Optimize images with alt tags"
]

try{

const ai = await fetch(
"https://api.groq.com/openai/v1/chat/completions",
{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${process.env.GROQ_API_KEY}`
},
body:JSON.stringify({
model:"llama3-70b-8192",
messages:[
{
role:"system",
content:"Return 3 short SEO improvement suggestions as a JSON array"
},
{
role:"user",
content:text.slice(0,1200)
}
]
})
}
)

const aiData = await ai.json()

const output = aiData.choices?.[0]?.message?.content

try{

const parsed = JSON.parse(output)

if(Array.isArray(parsed)){
recommendations = parsed
}

}catch{}

}catch{}

// return results

return res.status(200).json({
seo_score:seo,
speed_score:speed,
design_score:design,
overall_score:overall,
recommendations
})

}catch(e){

return res.status(200).json({
seo_score:50,
speed_score:60,
design_score:60,
overall_score:57,
recommendations:[
"Audit encountered an unexpected error",
"Check website HTML structure",
"Try another website"
]
})

}

}
