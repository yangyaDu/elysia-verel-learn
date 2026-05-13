import { SignJWT, jwtVerify } from 'jose'

const ALG = 'HS256'

function getJwtSecretBytes(): Uint8Array {
  const s = process.env.JWT_SECRET?.trim()
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET is required (min 16 characters)')
  }
  return new TextEncoder().encode(s)
}

export async function signAccessToken(params: {
  sub: string
  jti: string
  ttlSec: number
}): Promise<string> {
  const key = getJwtSecretBytes()
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(params.sub)
    .setJti(params.jti)
    .setIssuedAt(now)
    .setExpirationTime(now + params.ttlSec)
    .sign(key)
}

export async function verifyAccessToken(
  token: string
): Promise<{ sub: string; jti: string } | null> {
  try {
    const key = getJwtSecretBytes()
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] })
    const sub = typeof payload.sub === 'string' ? payload.sub : null
    const jti = typeof payload.jti === 'string' ? payload.jti : null
    if (!sub || !jti) {
      return null
    }
    return { sub, jti }
  } catch {
    return null
  }
}
