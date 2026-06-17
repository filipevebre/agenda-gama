import { corsHeaders } from "../_shared/cors.ts"
import { getVapidPublicKey } from "../_shared/push.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const publicKey = getVapidPublicKey()

  return new Response(JSON.stringify({
    publicKey,
    available: Boolean(publicKey)
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
})
