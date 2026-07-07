import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { handlers, signIn, signOut, auth } = NextAuth({
    // trustHost makes Auth.js accept the incoming Host/X-Forwarded-Host
    // header to compute the request origin, which on its own would let a
    // spoofed Host header influence redirect URLs behind a misconfigured
    // reverse proxy. The actual mitigation is that AUTH_URL (or the legacy
    // NEXTAUTH_URL, see node_modules/next-auth/lib/env.js:reqWithEnvURL) is
    // set explicitly per environment - when present it always overrides the
    // request's origin regardless of trustHost. docker-compose.yml already
    // sets NEXTAUTH_URL; make sure every real deployment (staging/prod)
    // overrides it with that environment's actual public origin before
    // exposing this app to the internet - never leave it defaulted to
    // http://localhost:3000.
    trustHost: true,
    providers: [
        Credentials({
            credentials: {
                username: { label: "Usuario", type: "text" },
                password: { label: "Contraseña", type: "password" },
            },
            async authorize(credentials) {
                const username = credentials?.username as string | undefined
                const password = credentials?.password as string | undefined

                if (!username || !password) return null

                const baseUrl = process.env.BCU_API_BASE_URL ?? ""
                if (!baseUrl) return null

                try {
                    const res = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username, password }),
                        cache: "no-store",
                    })

                    if (!res.ok) return null

                    const data = await res.json() as {
                        token: string
                        username: string
                        role: string
                        expiresAt: string
                    }

                    return {
                        id: data.username,
                        name: data.username,
                        backendToken: data.token,
                        role: data.role,
                    }
                } catch {
                    return null
                }
            },
        }),
    ],
    callbacks: {
        jwt({ token, user }) {
            if (user) {
                const u = user as { backendToken?: string; role?: string }
                token.backendToken = u.backendToken
                token.role = u.role
            }
            return token
        },
        session({ session, token }) {
            // Do NOT copy `backendToken` here: this callback's return value is
            // exactly what GET /api/auth/session sends to the browser and what
            // useSession() exposes client-side. The backend JWT must stay only
            // in the encrypted NextAuth JWT (set in the `jwt` callback above);
            // server-side code (BFF proxy routes) reads it via getToken() from
            // "next-auth/jwt" instead of via session.backendToken.
            return {
                ...session,
                role: token.role as string | undefined,
            }
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
})
