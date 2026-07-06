"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import { Loader2, Plus, Power, UserCog } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { getErrorMessage } from "@/lib/admin-api"
import {
  createUser,
  deactivateUser,
  listUsers,
  updateUser,
} from "@/lib/admin-users-api"
import type { UpdateUserRequest, UserResponse } from "@/types/admin"

const optionalEmail = z
  .union([z.string().email("Email invalido").max(200), z.literal("")])
  .optional()

const optionalName = z.string().max(120, "Maximo 120 caracteres").optional()

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Minimo 3 caracteres")
    .max(80, "Maximo 80 caracteres"),
  password: z
    .string()
    .min(8, "Minimo 8 caracteres")
    .max(100, "Maximo 100 caracteres"),
  role: z.enum(["ADMIN", "SUPER_ADMIN", "DEBTOR_VIEWER"]),
  email: optionalEmail,
  name: optionalName,
})

const updateUserSchema = z.object({
  role: z.enum(["ADMIN", "SUPER_ADMIN", "DEBTOR_VIEWER"]),
  active: z.boolean(),
  email: optionalEmail,
  name: optionalName,
})

type CreateUserForm = z.infer<typeof createUserSchema>
type UpdateUserForm = z.infer<typeof updateUserSchema>

function formatInstant(value: string | null) {
  if (!value) return "-"

  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm")
  } catch {
    return value
  }
}

export function UsersPanel() {
  const queryClient = useQueryClient()

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false)

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: listUsers,
  })

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])

  const effectiveSelectedUserId = useMemo(() => {
    if (!users.length) return null

    if (selectedUserId && users.some((u) => u.id === selectedUserId)) return selectedUserId

    return users[0].id
  }, [users, selectedUserId])

  const selectedUser = useMemo(
    () => users.find((u) => u.id === effectiveSelectedUserId) ?? null,
    [users, effectiveSelectedUserId],
  )

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async (user) => {
      setSelectedUserId(user.id)
      setCreateOpen(false)
      toast.success("Usuario creado", { description: user.username })
      await refresh()
    },
    onError: (error) => {
      toast.error("No se pudo crear el usuario", { description: getErrorMessage(error) })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserRequest }) =>
      updateUser(id, payload),
    onSuccess: async () => {
      setEditOpen(false)
      toast.success("Usuario actualizado")
      await refresh()
    },
    onError: (error) => {
      toast.error("No se pudo actualizar el usuario", { description: getErrorMessage(error) })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => deactivateUser(id),
    onSuccess: async () => {
      setConfirmDeactivateOpen(false)
      toast.success("Usuario desactivado")
      await refresh()
    },
    onError: (error) => {
      toast.error("No se pudo desactivar el usuario", { description: getErrorMessage(error) })
    },
  })

  const columns = useMemo<ColumnDef<UserResponse>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
      },
      {
        accessorKey: "username",
        header: "Usuario",
      },
      {
        accessorKey: "name",
        header: "Nombre",
        cell: ({ row }) => row.original.name ?? "-",
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => row.original.email ?? "-",
      },
      {
        accessorKey: "role",
        header: "Rol",
        cell: ({ row }) => (
          <Badge variant={row.original.role === "SUPER_ADMIN" ? "default" : "secondary"}>
            {row.original.role}
          </Badge>
        ),
      },
      {
        accessorKey: "active",
        header: "Estado",
        cell: ({ row }) =>
          row.original.active ? (
            <Badge variant="secondary">Activo</Badge>
          ) : (
            <Badge variant="outline">Inactivo</Badge>
          ),
      },
      {
        accessorKey: "createdAt",
        header: "Creado",
        cell: ({ row }) => formatInstant(row.original.createdAt),
      },
      {
        accessorKey: "lastLoginAt",
        header: "Ultimo acceso",
        cell: ({ row }) => formatInstant(row.original.lastLoginAt),
      },
    ],
    [],
  )

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: "", password: "", role: "ADMIN", email: "", name: "" },
  })

  const updateForm = useForm<UpdateUserForm>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      role: selectedUser?.role ?? "ADMIN",
      active: selectedUser?.active ?? true,
      email: selectedUser?.email ?? "",
      name: selectedUser?.name ?? "",
    },
  })

  useEffect(() => {
    if (!selectedUser) return

    updateForm.reset({
      role: selectedUser.role,
      active: selectedUser.active,
      email: selectedUser.email ?? "",
      name: selectedUser.name ?? "",
    })
  }, [selectedUser, updateForm])

  const submitCreate = createForm.handleSubmit((values) =>
    createMutation.mutate({
      username: values.username,
      password: values.password,
      role: values.role,
      email: values.email || null,
      name: values.name || null,
    }),
  )

  const submitUpdate = updateForm.handleSubmit((values) => {
    if (!effectiveSelectedUserId) return

    updateMutation.mutate({
      id: effectiveSelectedUserId,
      payload: {
        role: values.role,
        active: values.active,
        email: values.email || null,
        name: values.name || null,
      },
    })
  })

  return (
    <>
      <Card className="border border-slate-200/70">
        <CardHeader className="border-b border-slate-200/80">
          <CardTitle className="inline-flex items-center gap-2">
            <UserCog className="size-4 text-sky-700" />
            Usuarios admin
          </CardTitle>
          <CardDescription>
            Crea y administra los usuarios con acceso al panel de administracion.
          </CardDescription>
          <CardAction>
            <Button
              size="sm"
              type="button"
              onClick={() => {
                createForm.reset()
                setCreateOpen(true)
              }}
            >
              <Plus className="size-4" />
              Nuevo usuario
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {usersQuery.isPending ? (
            <div className="py-2">
              <div className="mb-2 flex gap-3 border-b pb-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-20" />
                ))}
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 border-b py-2.5">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-20" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={users}
              emptyMessage="No hay usuarios registrados"
              getRowId={(row) => String(row.id)}
              onRowClick={(row) => setSelectedUserId(row.id)}
              selectedRowId={
                effectiveSelectedUserId !== null ? String(effectiveSelectedUserId) : null
              }
            />
          )}

          {selectedUser ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditOpen(true)}
                type="button"
              >
                Editar usuario
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDeactivateOpen(true)}
                type="button"
                disabled={deactivateMutation.isPending || !selectedUser.active}
              >
                {deactivateMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Power className="size-4" />
                )}
                Desactivar
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario admin</DialogTitle>
            <DialogDescription>
              El usuario tendra acceso al panel de administracion segun su rol.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitCreate}>
            <div className="space-y-1.5">
              <Label htmlFor="newUsername">Usuario</Label>
              <Input id="newUsername" {...createForm.register("username")} />
              <p className="text-xs text-destructive">
                {createForm.formState.errors.username?.message}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Contrasena</Label>
              <Input id="newPassword" type="password" {...createForm.register("password")} />
              <p className="text-xs text-destructive">
                {createForm.formState.errors.password?.message}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Controller
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                      <SelectItem value="SUPER_ADMIN">SUPER_ADMIN</SelectItem>
                      <SelectItem value="DEBTOR_VIEWER">DEBTOR_VIEWER</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newEmail">Email <span className="text-muted-foreground">(opcional)</span></Label>
              <Input id="newEmail" type="email" {...createForm.register("email")} />
              <p className="text-xs text-destructive">
                {createForm.formState.errors.email?.message}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newName">Nombre <span className="text-muted-foreground">(opcional)</span></Label>
              <Input id="newName" {...createForm.register("name")} />
              <p className="text-xs text-destructive">
                {createForm.formState.errors.name?.message}
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Crear usuario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              Actualiza el rol y estado operativo del usuario.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitUpdate}>
            <div className="space-y-1.5">
              <Label>Usuario</Label>
              <Input disabled value={selectedUser?.username ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editEmail">Email <span className="text-muted-foreground">(opcional)</span></Label>
              <Input id="editEmail" type="email" {...updateForm.register("email")} />
              <p className="text-xs text-destructive">
                {updateForm.formState.errors.email?.message}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editName">Nombre <span className="text-muted-foreground">(opcional)</span></Label>
              <Input id="editName" {...updateForm.register("name")} />
              <p className="text-xs text-destructive">
                {updateForm.formState.errors.name?.message}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Controller
                control={updateForm.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                      <SelectItem value="SUPER_ADMIN">SUPER_ADMIN</SelectItem>
                      <SelectItem value="DEBTOR_VIEWER">DEBTOR_VIEWER</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={updateForm.control}
                name="active"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <span className="text-sm">Usuario activo</span>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={updateMutation.isPending || !effectiveSelectedUserId}
              >
                {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Guardar cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeactivateOpen} onOpenChange={setConfirmDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar desactivacion</DialogTitle>
            <DialogDescription>
              Esta accion desactiva al usuario {selectedUser?.username ?? "-"}.
              No podra iniciar sesion hasta que sea reactivado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setConfirmDeactivateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={!effectiveSelectedUserId || deactivateMutation.isPending}
              onClick={() => {
                if (!effectiveSelectedUserId) return

                deactivateMutation.mutate(effectiveSelectedUserId)
              }}
            >
              {deactivateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Confirmar desactivacion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
