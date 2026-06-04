"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Lock, User } from "lucide-react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const loginSchema = z.object({
    username: z.string().trim().min(1, "Ingrese su usuario"),
    password: z.string().min(1, "Ingrese su contraseña"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
    const router = useRouter()
    const [serverError, setServerError] = useState<string | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    })

    async function onSubmit(values: LoginFormValues) {
        setServerError(null)

        const result = await signIn("credentials", {
            username: values.username,
            password: values.password,
            redirect: false,
        })

        if (result?.error) {
            setServerError("Credenciales inválidas. Verificá tu usuario y contraseña.")
            return
        }

        router.push("/")
        router.refresh()
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground">
                        <Lock className="size-6" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight font-heading">BCU Admin Console</h1>
                    <p className="text-sm text-muted-foreground">Ingresá con tus credenciales de administración</p>
                </div>

                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Iniciar sesión</CardTitle>
                        <CardDescription>Acceso restringido a usuarios autorizados</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                            {serverError && (
                                <Alert variant="destructive">
                                    <AlertDescription>{serverError}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="username">Usuario</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                        id="username"
                                        type="text"
                                        autoComplete="username"
                                        autoFocus
                                        placeholder="admin"
                                        className="pl-9"
                                        aria-invalid={!!errors.username}
                                        {...register("username")}
                                    />
                                </div>
                                {errors.username && (
                                    <p className="text-xs text-destructive">{errors.username.message}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password">Contraseña</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                        id="password"
                                        type="password"
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                        className="pl-9"
                                        aria-invalid={!!errors.password}
                                        {...register("password")}
                                    />
                                </div>
                                {errors.password && (
                                    <p className="text-xs text-destructive">{errors.password.message}</p>
                                )}
                            </div>

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Ingresando…
                                    </>
                                ) : (
                                    "Ingresar"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-muted-foreground">
                    Plataforma de Integración BCU — uso interno
                </p>
            </div>
        </main>
    )
}
