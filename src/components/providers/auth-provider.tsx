"use client"

import { usePathname } from "next/navigation"
import { signOut, useSession, SessionProvider } from "next-auth/react"
import { useCallback, useEffect, useRef } from "react"

function SessionGuard() {
    const pathname = usePathname()
    const { status } = useSession()
    const signingOutRef = useRef(false)

    const forceLogout = useCallback(async () => {
        if (signingOutRef.current || pathname === "/login") {
            return
        }

        signingOutRef.current = true
        await signOut({ callbackUrl: "/login" })
    }, [pathname])

    useEffect(() => {
        if (status === "unauthenticated") {
            void forceLogout()
        }
    }, [status, forceLogout])

    useEffect(() => {
        const onSessionInvalid = () => {
            void forceLogout()
        }

        window.addEventListener("bcu:session-invalid", onSessionInvalid)

        return () => {
            window.removeEventListener("bcu:session-invalid", onSessionInvalid)
        }
    }, [forceLogout])

    return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <SessionGuard />
            {children}
        </SessionProvider>
    )
}
