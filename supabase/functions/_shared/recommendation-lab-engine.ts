import type { LabRun, LabState, LabWork, LabResult } from "../../../shared/recommendation-lab.ts";
import { SOURCES, CANDIDATE_SEEDS, MAX_ITEMS } from "./recommendation-lab-manifest.ts";
import { createLabProviders, matches, type LabSeed } from "./recommendation-lab-providers.ts";
import { createLabModels, type LabStore } from "./recommendation-lab-models.ts";
import { rankLab, publicWork, sameWork, LAB_WEIGHTS } from "./recommendation-lab-ranking.ts";

export function createRecommendationLab(store:LabStore,env:(k:string)=>string|undefined,actor:string,fetcher:typeof fetch=fetch){
  const providers=createLabProviders(env,fetcher),models=createLabModels(store,env("OPENAI_API_KEY"),fetcher);
  const seedPlan=[...SOURCES.map(s=>({key:s.key,seed:s,source:true})),
    ...CANDIDATE_SEEDS.map((s,index)=>({key:`candidate-${index}`,seed:s,source:false}))];
  async function state():Promise<LabState>{
    const data=await store("state");
    return {...data,sources:SOURCES,viewer_id:actor,stage:"bounded_checkpoint"};
  }
  async function step(){
    providers.resetBudget();
    const claim=await store("claim");
    let progress:Record<string,any>={},complete=false;
    try{
      const data=await store("dataset");
      progress={...data.ledger.progress};delete progress.lease_token;delete progress.lease_until;
      const processed={...(progress.processed||{})};
      let target:any=seedPlan.find(s=>!processed[s.key]);
      if(!target){
        // Provider recall is also bounded: at most the remaining slots, once.
        const relations=data.items.flatMap((w:LabWork)=>w.verification.recommendations||[])
          .filter((r:any,index:number,all:any[])=>all.findIndex(x=>x.source===r.source&&x.id===r.id&&x.type===r.type)===index);
        target=relations.map((r:any)=>({key:`provider-${r.type}-${r.id}`,relation:r,source:false}))
          .find((r:any)=>!processed[r.key]&&!data.items.some((w:LabWork)=>w.external_source===r.relation.source&&w.external_id===r.relation.id));
      }
      if(!target||data.items.length>=MAX_ITEMS){
        complete=true;progress.preparation_complete=true;
        progress.summary={items:data.items.length,profiled:data.items.filter((w:LabWork)=>["profiled","embedded"].includes(w.status)).length,
          embedded:data.items.filter((w:LabWork)=>w.status==="embedded").length};
        return {complete:true,summary:progress.summary};
      }
      let work:any=null,errors:string[]=[];
      try{
        if(target.relation){
          work=await providers.details(target.relation.source,target.relation.id,target.relation.type);
        }else{
          const catalog=await store("catalog",{titles:[target.seed.title]});
          const resolved=await providers.resolve(target.seed,catalog);
          work=resolved.work;errors=resolved.errors;
        }
        if(!work){processed[target.key]={status:"unavailable",errors};return {key:target.key,status:"unavailable"};}
        const existing=data.items.find((w:LabWork)=>w.external_source===work.external_source&&w.external_id===work.external_id);
        work.verification={...work.verification,origins:[target.relation?"TMDB recommendations":"deliberate stress-test seed"],
          ...(target.source?{source_key:target.key}:{}),...(existing?.verification||{})};
        if(target.source)work.verification.source_key=target.key;
        if(existing){
          work={...existing,verification:work.verification};
        }else{
          work=await store("save_item",work);
          try { work=await models.profile(work); } catch(e) {
            work.profile_evidence={missing:"Profile/embedding preparation failed; no synthetic fallback",error:(e as Error).message};
            errors.push((e as Error).message);
          }
        }
        await store("save_item",work);
        processed[target.key]={status:work.status,title:work.title,errors};
        return {key:target.key,title:work.title,status:work.status};
      }catch(e){
        processed[target.key]={status:"failed",errors:[...errors,(e as Error).message]};
        throw e;
      }finally{
        progress.processed=processed;
        progress.provider_requests=(progress.provider_requests||0)+providers.calls;
      }
    }finally{
      await store("release",{token:claim.token,progress,complete});
    }
  }
  async function compare(sourceKey:string){
    providers.resetBudget();
    const spec=SOURCES.find(s=>s.key===sourceKey);
    if(!spec)throw new Error("Unknown checkpoint source");
    const claim=await store("claim");
    try{
      const data=await store("dataset");
      if(!data.ledger.progress.preparation_complete)throw new Error("Finish bounded preparation before capturing frozen comparisons");
      const existing=data.runs.find((r:LabRun)=>r.configuration.sourceKey===sourceKey&&r.created_by===actor);
      if(existing)return {runId:existing.id,cached:true};
      const source:LabWork|undefined=data.items.find((w:LabWork)=>w.verification.source_key===sourceKey);
      if(!source)throw new Error("This source could not be provider-verified; see preparation diagnostics");
      const context=await store("context"),generation=await models.current(source.title,source.media_type,context);
      const current:LabResult[]=[],unavailable:any[]=[];
      for(const [index,rec] of generation.recommendations.entries()){
        const seed:LabSeed={title:rec.title,type:rec.type||rec.media_type||"",creator:rec.creator||rec.author||rec.artist,year:rec.year};
        if(!seed.title||typeof seed.title!=="string"){unavailable.push({index,reason:"Invalid generated title"});continue;}
        // CURRENT may propose works outside the prepared V2 pool. Resolve them
        // read-only and keep them only in this bounded results JSON; no profiles
        // or embeddings are prepared for those extra baseline suggestions.
        let item=data.items.find((w:LabWork)=>matches(seed,{title:w.title,creator:w.source_metadata.creator,type:w.media_type,year:w.source_metadata.release_year}));
        if(!item){const resolved=await providers.resolve(seed);item=resolved.work;}
        if(!item||sameWork(source,item)||current.some(r=>sameWork(r.item,item))){unavailable.push({index,title:seed.title,type:seed.type,reason:"Unavailable, unsupported, duplicate, or source itself"});continue;}
        item={...item,id:item.id||`${item.external_source}:${item.external_id}`};
        current.push({item:publicWork(item),score:null,trace:{
          origins:["CURRENT generator replay","read-only direct provider verification"],
          signals:{},contributions:{},missing:[],
          rank:index+1,notes:[rec.description||"No explanation supplied",
            "Exact consumer generation prompt/model/settings; isolated provider resolution instead of shared search, to prevent production enrichment writes."],
        }});
      }
      const run=await store("save_run",{sourceKey,label:`${source.title} · ${source.media_type}`,source_item_id:source.id,
        results:{current,structured:rankLab(source,data.items,false),semantic:rankLab(source,data.items,true)},
        diagnostics:{baseline:"consumer prompt/model replay, not an existing consumer cache snapshot",
          baseline_actor:actor,baseline_generated:generation.recommendations,baseline_unavailable:unavailable,
          baseline_explanation:generation.explanation,weights:LAB_WEIGHTS,
          semantic_floor:0.35,embedding_model:"text-embedding-3-small",embedding_dimensions:256,
          prepared_pool:data.items.length,provider_requests:providers.calls,
          current_resolution_difference:"Shared media-search is intentionally not called because it can write production identities/fingerprints. CURRENT resolution coverage may differ.",
          limitations:["Small, deliberately seeded shared candidate pool; not catalog-wide recall.",
            "Music descriptors are not evidence of sound/lyrics; missing dimensions remain missing.",
            "Podcast descriptions describe shows, not every episode.",
            "Profiles are limited to quoted provider descriptions; quotations prove provenance, not interpretation quality."],
        }});
      return {runId:run.id,cached:false};
    }finally{await store("release",{token:claim.token,progress:{},complete:true});}
  }
  return {state,step,compare,evaluate:(payload:Record<string,any>)=>store("evaluate",payload)};
}
