import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { id, email, first_name, username } = await req.json();

    if (!id || !email) {
      return new Response("Missing id or email", { status: 400, headers: corsHeaders });
    }

    const siteId = Deno.env.get("CUSTOMERIO_SITE_ID");
    const apiKey = Deno.env.get("CUSTOMERIO_TRACK_API_KEY");

    if (!siteId || !apiKey) {
      console.error("CUSTOMERIO_SITE_ID or CUSTOMERIO_TRACK_API_KEY not set");
      return new Response("Customer.io not configured", { status: 500, headers: corsHeaders });
    }

    const auth = btoa(`${siteId}:${apiKey}`);

    const response = await fetch(
      `https://track.customer.io/api/v1/customers/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          email,
          first_name: first_name || null,
          username: username || null,
          created_at: Math.floor(Date.now() / 1000),
          plan: "free",
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Customer.io error:", text);
      return new Response("Customer.io failed", { status: 500, headers: corsHeaders });
    }

    return new Response("Success", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});
