// Cloudflare Pages Function: reverse proxy /api/* -> API ISS.
// Il browser chiama lo stesso origin (/api/...) => nessun problema di CORS.
// Risponde in streaming, quindi lo stream SSE (/api/telemetry/stream) passa.
const UPSTREAM = 'https://iss.cdnspace.ca'

export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
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

  const response = await fetch(target, init)

  // Ricostruisce la risposta in streaming preservando gli header.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
