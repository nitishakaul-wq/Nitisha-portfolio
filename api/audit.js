export default async function handler(req,res){

if(req.method!=="POST"){
return res.status(405).json({error:"Method not allowed"})
}

try{

const {url}=req.body

if(!url){
return res.status(400).json({error:"No URL provided"})
}

// fetch website safely
const response=await fetch(url,{
headers:{
"User-Agent":"Mozilla/5.0"
}
})

const html=await response.text()

// -------- REAL CHECKS --------

const title=html.match(/<title>(.*?)</title>/i)
const meta=html.match(/name=["']description["']\s*content=["']([^%22]*)/i)
const h1=[...html.matchAll(/<h1/gi)]
const images=[...html.matchAll(/<img/gi)]
const alts=[...html.matchAll(/alt=/gi)]
const links=[...html.matchAll(/<a\s+href/gi)]

let seo=0
let speed=70
let design=70

// title
if(title){
const len=title[1].length
seo+=len>10 && len<60 ? 20 : 10
}

// meta
if(meta){
seo+=20
}

// h1
if(h1.length===1){
seo+=20
}else if(h1.length>1){
seo+=10
}

// alt tags
if(images.length>0){
const ratio=alts.length/images.length
seo+=Math.round(ratio*20)
}

// links
if(links.length>5){
seo+=10
}

// https
if(url.startsWith("https")){
seo+=10
}

// content length
const text=html.replace(/<[^>]*>/g,"")
if(text.length>2000){
seo+=10
}

if(seo>100){
seo=100
}

const overall=Math.round((seo+speed+design)/3)

// -------- AI SUGGESTIONS --------

let recommendations=[
"Add meta description",
"Improve heading hierarchy",
"Add alt text to images"
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
content:"You are an SEO expert. Return 3 short website improvement suggestions as a JSON array."
},
{
role:"user",
content:text.slice(0,2000)
}
]
})
})

const data=await ai.json()

const output=data.choices?.[0]?.message?.content

try{
const parsed=JSON.parse(output)
if(Array.isArray(parsed)){
recommendations=parsed
}
}catch{}

}catch{}

return res.status(200).json({
seo_score:seo,
speed_score:speed,
design_score:design,
overall_score:overall,
recommendations
})

}catch(e){

console.error(e)

return res.status(500).json({
error:"Audit failed"
})

}

}
