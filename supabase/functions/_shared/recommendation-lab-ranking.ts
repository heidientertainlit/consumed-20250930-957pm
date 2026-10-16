import type { LabProfile, LabResult, LabWork } from "../../../shared/recommendation-lab.ts";
import { normalize } from "./recommendation-lab-providers.ts";

// Fixed before observing checkpoint results. Do not tune during this checkpoint.
export const LAB_WEIGHTS = Object.freeze({
  provider:0.35, creator:0.12, relationship:0.45, genre:0.08,
  appeal:0.20, tone_style:0.12, subject_theme:0.06,
  semantic_appeal:0.24, semantic_tone_style:0.14, semantic_subject_theme:0.06,
});
const words=(s:string)=>normalize(s).split(" ").filter(x=>x.length>2&&!["the","and","with","from","that","this","for","fiction","general"].includes(x));
function overlap(a:string[],b:string[]):number|null{
  if(!a.length||!b.length)return null;
  const x=new Set(a),y=new Set(b),intersection=[...x].filter(k=>y.has(k)).length;
  return intersection/new Set([...x,...y]).size;
}
function tags(p:LabProfile,keys:(keyof LabProfile)[]){
  return keys.flatMap(k=>(p[k]||[]).flatMap(x=>words(x.label)));
}
export function cosine(a:number[]|string|null|undefined,b:number[]|string|null|undefined):number|null{
  if(typeof a==="string"){try{a=JSON.parse(a);}catch{return null;}}
  if(typeof b==="string"){try{b=JSON.parse(b);}catch{return null;}}
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==256||b.length!==256)return null;
  let sum=0,x=0,y=0;for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i])||!Number.isFinite(b[i]))return null;sum+=a[i]*b[i];x+=a[i]**2;y+=b[i]**2;}
  return x&&y?Math.max(-1,Math.min(1,sum/Math.sqrt(x*y))):null;
}
export function sameWork(a:LabWork,b:LabWork){
  return a.external_source===b.external_source&&a.external_id===b.external_id
    ||!!a.existing_canonical_id&&a.existing_canonical_id===b.existing_canonical_id
    ||a.media_type===b.media_type&&normalize(a.title)===normalize(b.title)
      &&!!normalize(a.source_metadata.creator)&&normalize(a.source_metadata.creator)===normalize(b.source_metadata.creator);
}
export function publicWork(w:LabWork):LabWork{
  const {appeal_embedding,tone_style_embedding,subject_theme_embedding,...visible}=w;
  return visible;
}
export function rankLab(source:LabWork,items:LabWork[],semantic:boolean):LabResult[]{
  const results:LabResult[]=[];
  for(const item of items){
    if(!item.source_verified||!item.destination_path||sameWork(source,item))continue;
    if(results.some(x=>sameWork(x.item,item)))continue;
    const a=source.source_metadata,b=item.source_metadata;
    const relation=(source.verification.recommendations||[]).find((r:any)=>r.source===item.external_source&&r.id===item.external_id&&r.type===item.media_type);
    const signals:Record<string,number|null>={
      provider:relation?1/relation.position:null,
      creator:a.creator&&b.creator?Number(normalize(a.creator)===normalize(b.creator)):null,
      relationship:a.story_key&&b.story_key?Number(a.story_key===b.story_key):
        a.collection&&b.collection?Number(normalize(a.collection)===normalize(b.collection)):null,
      genre:overlap((a.subjects||[]).flatMap(words),(b.subjects||[]).flatMap(words)),
      appeal:overlap(tags(source.profile,["appeal","experience"]),tags(item.profile,["appeal","experience"])),
      tone_style:overlap(tags(source.profile,["tone","style"]),tags(item.profile,["tone","style"])),
      subject_theme:overlap(tags(source.profile,["subject","themes"]),tags(item.profile,["subject","themes"])),
    };
    // Vector spaces must match. Unknown/missing dimensions are not fabricated.
    if(semantic){
      const compatible=source.status==="embedded"&&item.status==="embedded"
        &&(source as any).embedding_model===(item as any).embedding_model
        &&(source as any).embedding_dimensions===(item as any).embedding_dimensions
        &&source.profile_evidence?.extraction_version===item.profile_evidence?.extraction_version;
      signals.semantic_appeal=compatible?cosine(source.appeal_embedding,item.appeal_embedding):null;
      signals.semantic_tone_style=compatible?cosine(source.tone_style_embedding,item.tone_style_embedding):null;
      signals.semantic_subject_theme=compatible?cosine(source.subject_theme_embedding,item.subject_theme_embedding):null;
    }
    const contributions:Record<string,number>={};
    for(const [key,value] of Object.entries(signals)){
      // A predeclared floor avoids rewarding the positive baseline similarity of
      // unrelated embeddings; this is not calibrated from checkpoint outcomes.
      const normalized=key.startsWith("semantic_")?Math.max(0,((value??0)-0.35)/0.65):(value??0);
      contributions[key]=normalized*(LAB_WEIGHTS[key as keyof typeof LAB_WEIGHTS]||0);
    }
    const score=Object.values(contributions).reduce((sum,n)=>sum+n,0);
    if(score<=0)continue;
    const notes=[
      "Raw experimental score, not a probability or match percentage.",
      ...(a.story_key&&a.story_key===b.story_key?["Existing canonical story relationship (possible adaptation)."]:[]),
      ...(relation?[`TMDB recommends this title at position ${relation.position}; not independent proof of appeal.`]:[]),
      ...(item.profile_evidence?.missing?[String(item.profile_evidence.missing)]:[]),
    ];
    results.push({item:publicWork(item),score,trace:{
      origins:[...(item.verification.origins||["bounded stress-test catalog"]),...(relation?["TMDB recommendations"]:[])],
      signals,contributions,missing:Object.entries(signals).filter(([,v])=>v===null).map(([k])=>k),notes,
    }});
  }
  return results.sort((a,b)=>(b.score??0)-(a.score??0)||a.item.id.localeCompare(b.item.id)).slice(0,8)
    .map((r,index)=>({...r,trace:{...r.trace,rank:index+1}}));
}
