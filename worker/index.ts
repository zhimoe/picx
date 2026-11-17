interface Env {
  ASSETS: Fetcher
  BASIC_USER?: string
  BASIC_PASS?: string
}

function encodeBasic(user: string, pass: string): string {
  const bytes = new TextEncoder().encode(`${user}:${pass}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `Basic ${btoa(binary)}`
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'same-origin')
  headers.set('X-Frame-Options', 'DENY')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.BASIC_USER || !env.BASIC_PASS) {
      return new Response('Auth is not configured.', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    const expected = encodeBasic(env.BASIC_USER, env.BASIC_PASS)
    const provided = request.headers.get('Authorization') ?? ''

    if (!safeEqual(provided, expected)) {
      return new Response('Unauthorized', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="PicX Mini", charset="UTF-8"',
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    }

    const response = await env.ASSETS.fetch(request)
    return withSecurityHeaders(response)
  },
}
