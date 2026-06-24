import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
    interface User {
        backendToken?: string
        role?: string
    }
    interface Session {
        backendToken?: string
        role?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        backendToken?: string
        role?: string
    }
}
