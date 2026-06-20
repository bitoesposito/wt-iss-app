// Cloudflare Worker entry (deploy "Workers + Assets").
// - /api/*  -> reverse proxy verso l'API ISS, in streaming (SSE incluso).
//             Stesso origin del sito => nessun problema di CORS.
// - tutto il resto -> asset statici (con fallback SPA su index.html).
const UPSTREAM = 'https://iss.cdnspace.ca'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      const target = `${UPSTREAM}${url.pathname}${url.search}`

      const init = {
        method: request.method,
        headers: request.headers,
        redirect: 'follow',
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body
        init.duplex = 'half'
      }

      const upstream = await fetch(target, init)

      // Ricostruisce la risposta in streaming. Rimuove gli header di codifica/
      // lunghezza per evitare che il browser ridecodifichi un corpo già decodato
      // (romperebbe il parsing dello stream SSE).
      const headers = new Headers(upstream.headers)
      headers.delete('content-encoding')
      headers.delete('content-length')

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      })
    }

    // Asset statici / SPA.
    return env.ASSETS.fetch(request)
  },
}
