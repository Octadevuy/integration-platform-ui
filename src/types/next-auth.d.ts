import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
    interface User {
        backendToken?: string
        role?: string
    }
    interface Session {
        // backendToken intentionally omitted: it must never be part of the
        // client-visible session (see session() callback in src/auth.ts).
        // Server-side code reads it via getToken() from "next-auth/jwt".
        role?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        backendToken?: string
        role?: string
    }
}
