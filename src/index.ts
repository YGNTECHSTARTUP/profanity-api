
import { Index } from "@upstash/vector";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";
declare module "hono"{
  interface ContextVariableMap{
    ratelimit:Ratelimit
  }
}
const app = new Hono();
const cache = new Map();

class RedisRatelimit {
 static instance:Ratelimit
 static getInstance(){
  if(!this.instance){
    const redis = new Redis({
      url:"https://tops-goat-36832.upstash.io",
      token:"AY_gAAIncDE4ODQxYTI1ZTY5ZmE0Mjk3OWU5MDE5MzQ1NTJmODg2NXAxMzY4MzI"
    })
    this.instance = new Ratelimit({
      redis:redis,
      limiter:Ratelimit.slidingWindow(100,'1h'),
      ephemeralCache:cache
    })
    
  }
  return this.instance
 }  
}
app.use(async(c,next)=>{
  const ratelimit = RedisRatelimit.getInstance()
  c.set("ratelimit",ratelimit)
  await next()
})
app.use(cors())
app.post('/',async(c)=>{
  try{
    const ratelimit = c.get("ratelimit")
    const ip = c.req.raw.headers.get("cf-connecting-ip")
    const {success} = await ratelimit.limit(ip ?? "anonymous")
    if(!success){
      return c.json({error:"Rate Limit Exceeded"},{status:429})
    }
    const index = new Index({
   
    cache: false,
    url: "https://accurate-anchovy-84525-eu1-vector.upstash.io",
    token: "ABoFMGFjY3VyYXRlLWFuY2hvdnktODQ1MjUtZXUxYWRtaW5aV0ZrT0dRek56TXRPV0kwTkMwMFlUUmpMVGhtTldFdFlXWXhNRFF4T1dSak5UZG0=",
  
  });

    if(c.req.header('Content-Type')!=="application/json"){
      return c.json({error:"It is not in JSON format"},{status:406})
    }
    const start =  performance.now()
    const body = await c.req.json();
    const {message} = body as {message:string}
    if(message.length > 1000){
      return c.json({error:"Too Large to Handle"},{status:413})
    }
    const [words,semantc] = await Promise.all([wordssplitter(message),semantcsplitter(message)])
    const flaggedFor = new Set<{
      score:number,
      word:string
    }>()
     const vectorRes = await Promise.all([
      ...words.map(async (word)=>{
        const [query] = await index.query({
          topK:1,
          data:word,
          includeMetadata:true
        })
        if(query && query.score >0.95){
          flaggedFor.add({
            score:query.score,
            word:word
          })
        }
        return {score:0} 
      }),
      ...semantc.map(async(words)=>{
        const [query] = await index.query({
          topK:1,
          data:words,
          includeMetadata:true
        })
        if(query && query.score > 0.85){
          flaggedFor.add({
            score:query.score,
            word:words
          })
        }
        return query!
      })
    ])
   const end =  performance.now()
    if(flaggedFor.size > 0 ){
      const profane = Array.from(flaggedFor).sort((a,b)=>a.score > b.score ? -1 : 1)[0]
      return c.json({
        isProfane:true,
        word:profane,
        performance:-(start-end)
      })
    }
    else{
      
      return c.json({
        isProfane:false,
        performance:-(start-end)
      })
    }
  }
  catch(e){
    console.log(e)
  }
})

const semantic = new RecursiveCharacterTextSplitter({
  chunkOverlap:4,
  chunkSize:10
})

function wordssplitter(message:string)  {
 return message.split(/\s/)
}

async function semantcsplitter(message:string){
  const chunky = await semantic.createDocuments([message])
  const chunks = chunky.map((ch)=>ch.pageContent)
  return chunks

}

export default app;
