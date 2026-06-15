import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

/**
 * Mock users — replace with a real backend call when authentication
 * is implemented server-side.
 */
const MOCK_USERS = [
    {
        id: "1",
        name: "Admin BCU",
        email: "admin@bcu.uy",
        username: "admin",
        password: "admin123",
    },
]

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

                if (!username || !password) {
                    return null
                }

                const user = MOCK_USERS.find(
                    (u) => u.username === username && u.password === password,
                )

                if (!user) {
                    return null
                }

                return { id: user.id, name: user.name, email: user.email }
            },
        }),
    ],
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
})
