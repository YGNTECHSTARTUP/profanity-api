import csv from "csv-parser"
import fs from "fs"
import { Index } from "@upstash/vector"
import { resolve } from "dns"
import { rejects } from "assert"

interface Row {
  text:string
}
const index = new Index({
  url: "https://accurate-anchovy-84525-eu1-vector.upstash.io",
  token: "ABoFMGFjY3VyYXRlLWFuY2hvdnktODQ1MjUtZXUxYWRtaW5aV0ZrT0dRek56TXRPV0kwTkMwMFlUUmpMVGhtTldFdFlXWXhNRFF4T1dSak5UZG0=",
})


const parseCsv = (filepath:string):Promise<Row[]>=>{
  return new Promise((resolve,rejects)=>{
    const rows:Row[] = [];
    fs.createReadStream(filepath).pipe(csv({
      separator:','
    })).on("data",(row)=>{
      rows.push(row)
    }).on("error",(err)=>rejects(err)).on("end",()=>{
      resolve(rows)
    })
  })
}
const seed = async () => {
  const data = await parseCsv("../trainig_data.csv")
  console.log(data)
  const STEP = 30
  for (let i=0;i<data.length;i+=STEP){
    const dataChunk = data.slice(i,i + STEP)
    const formatted = dataChunk.map((row,index)=>{
      return {
        data:row.text,
        id:index+1,
        metadata:{text:row.text}
    
      }
    })
    console.log(formatted)
    index.upsert(formatted)
  }

}
seed()
