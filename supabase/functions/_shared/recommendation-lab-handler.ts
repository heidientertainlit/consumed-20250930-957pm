type Dependencies = {
  authorize:(req:Request)=>Promise<{authorized:boolean;userId?:string;status?:number;caller?:string}>;
  engine:(userId:string)=>{state:()=>Promise<any>;step:()=>Promise<any>;compare:(key:string)=>Promise<any>;evaluate:(p:any)=>Promise<any>};
};
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
export function recommendationLabHandler(deps:Dependencies){
  return async(req:Request)=>{
    const response=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
    if(req.method==="OPTIONS")return response({ok:true});
    if(req.method!=="POST")return response({error:"POST required"},405);
    try{
      const auth=await deps.authorize(req);
      if(!auth.authorized||auth.caller!=="admin"||!auth.userId)return response({error:"A human admin session is required"},auth.status||403);
      if(Number(req.headers.get("content-length")||0)>8192)return response({error:"Request too large"},413);
      const text=await req.text();
      if(text.length>8192)return response({error:"Request too large"},413);
      let body:any;try{body=JSON.parse(text);}catch{return response({error:"Invalid JSON"},400);}
      if(!body||typeof body!=="object"||Array.isArray(body))return response({error:"Invalid request"},400);
      // Never accept actor IDs, provider IDs, model settings, seeds or weights.
      const allowed:Record<string,string[]>={
        state:["action"],step:["action"],compare:["action","sourceKey"],
        evaluate:["action","runId","variant","candidateId","verdict","reasons","note"],
      };
      if(!allowed[body.action]||Object.keys(body).some(k=>!allowed[body.action].includes(k)))return response({error:"Unsupported lab request"},400);
      const engine=deps.engine(auth.userId);
      if(body.action==="state")return response(await engine.state());
      if(body.action==="step")return response(await engine.step());
      if(body.action==="compare"){
        if(typeof body.sourceKey!=="string"||body.sourceKey.length>100)return response({error:"Invalid source"},400);
        return response(await engine.compare(body.sourceKey));
      }
      if(typeof body.runId!=="string"||!/^[a-f0-9-]{36}$/i.test(body.runId)
        ||typeof body.candidateId!=="string"||body.candidateId.length>250
        ||!["current","structured","semantic"].includes(body.variant)
        ||!["Great","Fine","Bad"].includes(body.verdict)
        ||!Array.isArray(body.reasons)||body.reasons.length>6||body.reasons.some((r:any)=>typeof r!=="string")
        ||typeof body.note!=="string"||body.note.length>500)return response({error:"Invalid evaluation"},400);
      return response(await engine.evaluate(body));
    }catch(e){
      const message=(e as Error).message||"Lab operation failed";
      // Errors originate from controlled workers/providers, not response bodies.
      return response({error:message},message.includes("Another lab step")?409:400);
    }
  };
}
