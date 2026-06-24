import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { handlers, signIn, signOut, auth } = NextAuth({
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
            return {
                ...session,
                backendToken: token.backendToken as string | undefined,
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
