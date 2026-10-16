import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeAdminOrService } from "../_shared/authorization.ts";
import { recommendationLabHandler } from "../_shared/recommendation-lab-handler.ts";
import { createRecommendationLab } from "../_shared/recommendation-lab-engine.ts";

const admin=()=>createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{
  auth:{persistSession:false,autoRefreshToken:false},
});
serve(recommendationLabHandler({
  async authorize(req){
    const auth=await authorizeAdminOrService(req);
    if(!auth.authorized||auth.caller!=="admin")return auth;
    const {data,error}=await admin().from("users").select("is_persona").eq("id",auth.userId).maybeSingle();
    if(error||!data||data.is_persona)return {authorized:false,status:403};
    return auth;
  },
  engine(actor){
    const client=admin();
    return createRecommendationLab(async(action,payload={})=>{
      const {data,error}=await client.rpc("recommendation_lab_worker",{p_action:action,p_actor:actor,p_payload:payload});
      if(error)throw new Error(error.message);
      return data;
    },k=>Deno.env.get(k),actor);
  },
}));
