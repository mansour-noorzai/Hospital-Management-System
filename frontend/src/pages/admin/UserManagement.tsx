import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/Shared/StatusBadge";
import { useAppSelector } from "@/store/hooks";
import { PrintReportButton, type PrintableReport } from "@/components/Shared/PrintReportButton";

type Role = "admin" | "doctor" | "nurse" | "receptionist" | "patient";

type UserStatus = "active" | "suspended" | "pendingActivation";

interface UserRecord {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  status?: UserStatus | null;
  isActive?: boolean | null;
  lastLogin?: string;
  createdAt: string;
  profile?: {
    specialization?: string;
    qualification?: string[];
    licenseNumber?: string;
    consultationFee?: number;
    ward?: string;
    shift?: string;
    department?: {
      _id?: string;
      name?: string;
    };
  } | null;
}

interface UsersResponse {
  data: UserRecord[];
  meta: {
    page: number;
    total: number;
    totalPages: number;
  };
}

interface ProfileForm {
  specialization: string;
  departmentId: string;
  qualification: string;
  licenseNumber: string;
  consultationFee: string;
  ward: string;
  shift: "morning" | "afternoon" | "night";
}

interface FormState extends ProfileForm {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  temporaryPassword: string;
}

const emptyProfile: ProfileForm = {
  specialization: "",
  departmentId: "",
  qualification: "",
  licenseNumber: "",
  consultationFee: "",
  ward: "",
  shift: "morning",
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  role: "patient",
  temporaryPassword: "",
  ...emptyProfile,
};

function getUserStatus(user: UserRecord): UserStatus {
  if (
    user.status === "active" ||
    user.status === "suspended" ||
    user.status === "pendingActivation"
  ) {
    return user.status;
  }

  return user.isActive === false ? "suspended" : "active";
}

function userReport(user: UserRecord): PrintableReport {
  return {
    title: "User Record", subtitle: `${user.firstName} ${user.lastName}`, reference: user._id,
    fields: [
      { label: "Name", value: `${user.firstName} ${user.lastName}` }, { label: "Email", value: user.email }, { label: "Phone", value: user.phone },
      { label: "Role", value: user.role }, { label: "Status", value: getUserStatus(user) }, { label: "Department", value: user.profile?.department?.name },
      { label: "Specialization", value: user.profile?.specialization }, { label: "Qualifications", value: user.profile?.qualification?.join(", ") },
      { label: "License number", value: user.profile?.licenseNumber }, { label: "Consultation fee", value: user.profile?.consultationFee },
      { label: "Ward", value: user.profile?.ward }, { label: "Shift", value: user.profile?.shift },
      { label: "Created", value: user.createdAt ? new Date(user.createdAt).toLocaleString() : "—" },
      { label: "Last login", value: user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never" },
    ],
  };
}

function usersReport(users: UserRecord[]): PrintableReport {
  return { title: "All Hospital Users", fields: [{ label: "Total users", value: users.length }], tables: [{ columns: ["Name", "Email", "Phone", "Role", "Department", "Specialization / Ward", "Shift", "Status", "Created", "Last login"], rows: users.map((user) => [`${user.firstName} ${user.lastName}`, user.email, user.phone, user.role, user.profile?.department?.name, user.profile?.specialization ?? user.profile?.ward, user.profile?.shift, getUserStatus(user), user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—", user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"]) }] };
}

export function AdminUserManagement() {
  const currentUser = useAppSelector((state) => state.auth.user);

  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [generatedPassword, setGeneratedPassword] = useState("");

  const [roleTarget, setRoleTarget] = useState<UserRecord | null>(null);
  const [newRole, setNewRole] = useState<Role>("patient");
  const [roleProfile, setRoleProfile] = useState<ProfileForm>(emptyProfile);

  const [editTarget, setEditTarget] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    ...emptyProfile,
  });

  const [permissionTarget, setPermissionTarget] = useState<UserRecord | null>(
    null,
  );
  const [grants, setGrants] = useState<string[]>([]);
  const [denies, setDenies] = useState<string[]>([]);

  const params = useMemo(
    () =>
      new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search ? { search } : {}),
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      }).toString(),
    [page, role, search, status],
  );

  const users = useQuery<UsersResponse>({
    queryKey: ["users", page, search, role, status],
    queryFn: () =>
      api.get(`/users?${params}`).then((response) => response.data),
  });

  const allUsersParams = useMemo(() => {
    const all = new URLSearchParams(params);
    all.set("page", "1");
    all.set("limit", "100");
    return all.toString();
  }, [params]);

  const allUsers = useQuery<UsersResponse>({
    queryKey: ["users", "print-all", search, role, status],
    queryFn: () => api.get(`/users?${allUsersParams}`).then((response) => response.data),
  });

  const departments = useQuery<{
    data: Array<{
      _id: string;
      name: string;
    }>;
  }>({
    queryKey: ["departments"],
    queryFn: () => api.get("/departments").then((response) => response.data),
  });

  const catalog = useQuery<{
    data: string[];
  }>({
    queryKey: ["permissions", "catalog"],
    queryFn: () =>
      api.get("/users/permissions/catalog").then((response) => response.data),
  });

  useEffect(() => {
    const socket = getSocket();

    const refreshUsers = () => {
      void queryClient.invalidateQueries({
        queryKey: ["users"],
      });
    };

    socket.on("user.created", refreshUsers);
    socket.on("user.updated", refreshUsers);
    socket.on("user.deactivated", refreshUsers);
    socket.on("user.reactivated", refreshUsers);
    socket.on("user.roleChanged", refreshUsers);

    return () => {
      socket.off("user.created", refreshUsers);
      socket.off("user.updated", refreshUsers);
      socket.off("user.deactivated", refreshUsers);
      socket.off("user.reactivated", refreshUsers);
      socket.off("user.roleChanged", refreshUsers);
    };
  }, [queryClient]);

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["users"],
    });

  const create = useMutation({
    mutationFn: () =>
      api
        .post("/users", {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          role: form.role,
          ...(form.temporaryPassword
            ? {
                temporaryPassword: form.temporaryPassword,
              }
            : {}),
          ...profilePayload(form.role, form),
        })
        .then((response) => response.data.data),

    onSuccess: (data) => {
      setGeneratedPassword(data.temporaryPassword);
      setForm(emptyForm);
      void refresh();
      toast.success("User created");
    },

    onError: showError,
  });

  const changeStatus = useMutation({
    mutationFn: ({
      id,
      status: nextStatus,
    }: {
      id: string;
      status: "active" | "suspended";
    }) =>
      api.patch(`/users/${id}/status`, {
        status: nextStatus,
      }),

    onSuccess: () => {
      void refresh();
      toast.success("Account status updated");
    },

    onError: showError,
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) =>
      api
        .post(`/users/${id}/reset-password`)
        .then((response) => response.data.data),

    onSuccess: (data) => {
      setGeneratedPassword(data.temporaryPassword);
    },

    onError: showError,
  });

  const changeRole = useMutation({
    mutationFn: () =>
      api.patch(`/users/${roleTarget!._id}/role`, {
        role: newRole,
        ...profilePayload(newRole, roleProfile),
      }),

    onSuccess: () => {
      setRoleTarget(null);
      void refresh();
      toast.success("Role changed and existing sessions revoked");
    },

    onError: showError,
  });

  const updateUser = useMutation({
    mutationFn: () =>
      api.patch(`/users/${editTarget!._id}`, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        ...(editForm.phone.trim() ? { phone: editForm.phone.trim() } : {}),
        ...profilePayload(editTarget!.role, editForm),
      }),

    onSuccess: () => {
      setEditTarget(null);
      void refresh();
      toast.success("User updated");
    },

    onError: showError,
  });

  const savePermissions = useMutation({
    mutationFn: () =>
      api.put(`/users/${permissionTarget!._id}/permissions`, {
        grants,
        denies,
      }),

    onSuccess: () => {
      setPermissionTarget(null);
      toast.success("Permissions updated and sessions revoked");
    },

    onError: showError,
  });

  async function openPermissions(user: UserRecord) {
    try {
      const response = await api.get(`/users/${user._id}`);

      setGrants(response.data.data.permissions?.grants ?? []);

      setDenies(response.data.data.permissions?.denies ?? []);

      setPermissionTarget(user);
    } catch (error) {
      showError(error);
    }
  }

  async function openEdit(user: UserRecord) {
    try {
      const response = await api.get(`/users/${user._id}`);

      const detail = response.data.data as {
        user: UserRecord;
        profile?: UserRecord["profile"];
      };

      const full: UserRecord = {
        ...detail.user,
        profile: detail.profile ?? null,
      };

      setEditTarget(full);

      setEditForm({
        firstName: full.firstName,
        lastName: full.lastName,
        phone: full.phone ?? "",
        departmentId: full.profile?.department?._id ?? "",
        specialization: full.profile?.specialization ?? "",
        qualification: full.profile?.qualification?.join(", ") ?? "",
        licenseNumber: full.profile?.licenseNumber ?? "",
        consultationFee:
          full.profile?.consultationFee === undefined
            ? ""
            : String(full.profile.consultationFee),
        ward: full.profile?.ward ?? "",
        shift: (full.profile?.shift as ProfileForm["shift"]) ?? "morning",
      });
    } catch (error) {
      showError(error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>

          <p className="text-muted-foreground">
            All hospital accounts, roles, status and permissions
          </p>
        </div>

        <div className="flex flex-wrap gap-2"><PrintReportButton report={usersReport(allUsers.data?.data ?? users.data?.data ?? [])} label="Print all / Save PDF" />
        <Button
          onClick={() => {
            setGeneratedPassword("");
            setCreateOpen(true);
          }}
        >
          Create User
        </Button>
        </div>
      </div>

      {users.isError && (
        <Card>
          <CardContent className="pt-6">
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-4"
            >
              <p className="font-medium text-destructive">
                Unable to load users
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {errorMessage(users.error)}
              </p>

              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={() => void users.refetch()}
              >
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <Input
              aria-label="Search users"
              placeholder="Search name or email"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />

            <Select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              <option value="admin">admin</option>
              <option value="doctor">doctor</option>
              <option value="nurse">nurse</option>
              <option value="receptionist">receptionist</option>
              <option value="patient">patient</option>
            </Select>

            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </Select>
          </div>

          {users.isLoading && (
            <p className="py-10 text-center text-muted-foreground">
              Loading users...
            </p>
          )}

          {!users.isLoading && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-muted-foreground">
                    {[
                      "User",
                      "Role",
                      "Department",
                      "Status",
                      "Created",
                      "Last login",
                      "Actions",
                    ].map((column) => (
                      <th
                        key={column}
                        className="px-3 py-3 text-start font-medium"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {users.data?.data.map((user) => {
                    const userStatus = getUserStatus(user);

                    return (
                      <tr key={user._id} className="border-b last:border-0">
                        <td className="px-3 py-3">
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {user.email}
                          </div>
                        </td>

                        <td className="px-3 py-3 capitalize">{user.role}</td>

                        <td className="px-3 py-3">
                          {user.profile?.department?.name ?? "—"}
                        </td>

                        <td className="px-3 py-3">
                          <StatusBadge status={userStatus} />
                        </td>

                        <td className="px-3 py-3">
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString()
                            : "—"}
                        </td>

                        <td className="px-3 py-3">
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleString()
                            : "Never"}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void openEdit(user)}
                            >
                              View / Edit
                            </Button>

                            <PrintReportButton report={userReport(user)} />

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRoleTarget(user);
                                setNewRole(user.role);
                                setRoleProfile(emptyProfile);
                              }}
                            >
                              Role
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void openPermissions(user)}
                            >
                              Permissions
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resetPassword.isPending}
                              onClick={() => resetPassword.mutate(user._id)}
                            >
                              Reset password
                            </Button>

                            <Button
                              size="sm"
                              variant={
                                userStatus === "active"
                                  ? "destructive"
                                  : "outline"
                              }
                              disabled={changeStatus.isPending}
                              onClick={() => {
                                const nextStatus =
                                  userStatus === "active"
                                    ? "suspended"
                                    : "active";

                                const action =
                                  nextStatus === "suspended"
                                    ? "Suspend"
                                    : "Reactivate";

                                if (
                                  window.confirm(`${action} ${user.email}?`)
                                ) {
                                  changeStatus.mutate({
                                    id: user._id,
                                    status: nextStatus,
                                  });
                                }
                              }}
                            >
                              {userStatus === "active"
                                ? "Suspend"
                                : "Reactivate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!users.data?.data.length && (
                <p className="py-10 text-center text-muted-foreground">
                  No users found
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {users.data?.meta.total ?? 0} users
            </span>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((currentPage) => currentPage - 1)}
              >
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= (users.data?.meta.totalPages ?? 1)}
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className="max-w-xl"
          onClose={() => setCreateOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input
                  required
                  value={form.firstName}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      firstName: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Last name">
                <Input
                  required
                  value={form.lastName}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      lastName: event.target.value,
                    })
                  }
                />
              </Field>
            </div>

            <Field label="Email">
              <Input
                type="email"
                required
                value={form.email}
                onChange={(event) =>
                  setForm({
                    ...form,
                    email: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Role">
              <Select
                value={form.role}
                onChange={(event) =>
                  setForm({
                    ...form,
                    role: event.target.value as Role,
                  })
                }
              >
                <option value="patient">patient</option>
                <option value="doctor">doctor</option>
                <option value="nurse">nurse</option>
                <option value="receptionist">receptionist</option>

                {currentUser?.isPlatformAdmin && (
                  <option value="admin">admin</option>
                )}
              </Select>
            </Field>

            <RoleProfileFields
              role={form.role}
              value={form}
              onChange={(patch) =>
                setForm({
                  ...form,
                  ...patch,
                })
              }
              departments={departments.data?.data ?? []}
            />

            <Field label="Temporary password (leave empty to generate)">
              <Input
                type="password"
                value={form.temporaryPassword}
                onChange={(event) =>
                  setForm({
                    ...form,
                    temporaryPassword: event.target.value,
                  })
                }
              />
            </Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  create.isPending ||
                  !form.firstName.trim() ||
                  !form.lastName.trim() ||
                  !form.email.trim() ||
                  (form.role === "doctor" && !form.specialization.trim())
                }
              >
                {create.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(roleTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRoleTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-xl" onClose={() => setRoleTarget(null)}>
          <DialogHeader>
            <DialogTitle>Change role for {roleTarget?.email}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Field label="New role">
              <Select
                value={newRole}
                onChange={(event) => {
                  setNewRole(event.target.value as Role);
                  setRoleProfile(emptyProfile);
                }}
              >
                <option value="patient">patient</option>
                <option value="doctor">doctor</option>
                <option value="nurse">nurse</option>
                <option value="receptionist">receptionist</option>

                {currentUser?.isPlatformAdmin && (
                  <option value="admin">admin</option>
                )}
              </Select>
            </Field>

            <RoleProfileFields
              role={newRole}
              value={roleProfile}
              onChange={(patch) =>
                setRoleProfile({
                  ...roleProfile,
                  ...patch,
                })
              }
              departments={departments.data?.data ?? []}
            />

            <p className="text-sm text-muted-foreground">
              Existing sessions will be revoked. Previous clinical profiles are
              preserved.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)}>
              Cancel
            </Button>

            <Button
              disabled={
                newRole === roleTarget?.role ||
                (newRole === "doctor" && !roleProfile.specialization.trim()) ||
                changeRole.isPending
              }
              onClick={() => changeRole.mutate()}
            >
              {changeRole.isPending ? "Changing..." : "Change role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-xl" onClose={() => setEditTarget(null)}>
          <DialogHeader>
            <DialogTitle>View / Edit user</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <Field label="Email">
              <Input value={editTarget?.email ?? ""} disabled />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input
                  required
                  value={editForm.firstName}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      firstName: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Last name">
                <Input
                  required
                  value={editForm.lastName}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      lastName: event.target.value,
                    })
                  }
                />
              </Field>
            </div>

            <Field label="Phone">
              <Input
                value={editForm.phone}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    phone: event.target.value,
                  })
                }
              />
            </Field>

            {editTarget && (
              <RoleProfileFields
                role={editTarget.role}
                value={editForm}
                onChange={(patch) =>
                  setEditForm({
                    ...editForm,
                    ...patch,
                  })
                }
                departments={departments.data?.data ?? []}
              />
            )}

            <div className="rounded-lg bg-muted p-3 text-sm">
              <div>
                Role:{" "}
                <span className="capitalize">{editTarget?.role ?? "—"}</span>
              </div>

              <div>Status: {editTarget ? getUserStatus(editTarget) : "—"}</div>

              <div>
                Created:{" "}
                {editTarget?.createdAt
                  ? new Date(editTarget.createdAt).toLocaleString()
                  : "—"}
              </div>

              <div>
                Last login:{" "}
                {editTarget?.lastLogin
                  ? new Date(editTarget.lastLogin).toLocaleString()
                  : "Never"}
              </div>
            </div>
          </div>

          <DialogFooter>
            {editTarget && <PrintReportButton report={userReport(editTarget)} />}
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>

            <Button
              disabled={
                !editForm.firstName.trim() ||
                !editForm.lastName.trim() ||
                (editTarget?.role === "doctor" &&
                  !editForm.specialization.trim()) ||
                updateUser.isPending
              }
              onClick={() => updateUser.mutate()}
            >
              {updateUser.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(permissionTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setPermissionTarget(null);
          }
        }}
      >
        <DialogContent onClose={() => setPermissionTarget(null)}>
          <DialogHeader>
            <DialogTitle>
              Permission overrides — {permissionTarget?.email}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {catalog.isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading permissions...
              </p>
            )}

            {catalog.data?.data.map((permission) => (
              <div
                key={permission}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border p-2"
              >
                <span className="text-sm">{permission}</span>

                <label className="text-xs">
                  <input
                    type="checkbox"
                    checked={grants.includes(permission)}
                    onChange={(event) => {
                      setGrants(
                        toggle(grants, permission, event.target.checked),
                      );

                      if (event.target.checked) {
                        setDenies(denies.filter((item) => item !== permission));
                      }
                    }}
                  />{" "}
                  Allow
                </label>

                <label className="text-xs">
                  <input
                    type="checkbox"
                    checked={denies.includes(permission)}
                    onChange={(event) => {
                      setDenies(
                        toggle(denies, permission, event.target.checked),
                      );

                      if (event.target.checked) {
                        setGrants(grants.filter((item) => item !== permission));
                      }
                    }}
                  />{" "}
                  Deny
                </label>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionTarget(null)}>
              Cancel
            </Button>

            <Button
              disabled={savePermissions.isPending}
              onClick={() => savePermissions.mutate()}
            >
              {savePermissions.isPending ? "Saving..." : "Save permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(generatedPassword)}
        onOpenChange={(open) => {
          if (!open) {
            setGeneratedPassword("");
          }
        }}
      >
        <DialogContent onClose={() => setGeneratedPassword("")}>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Copy it now. It will not be shown again.
          </p>

          <code className="break-all rounded-lg bg-muted p-4 text-base">
            {generatedPassword}
          </code>

          <DialogFooter>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(generatedPassword);
                toast.success("Copied");
              }}
            >
              Copy
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setGeneratedPassword("");
                setCreateOpen(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function profilePayload(
  role: Role,
  value: ProfileForm,
): Record<string, unknown> {
  if (!["doctor", "nurse", "receptionist"].includes(role)) {
    return {};
  }

  const common = {
    departmentId: value.departmentId || null,
    ...(value.qualification.trim()
      ? {
          qualification: value.qualification
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }
      : {}),
  };

  if (role === "doctor") {
    return {
      ...common,
      specialization: value.specialization.trim(),
      ...(value.licenseNumber.trim()
        ? {
            licenseNumber: value.licenseNumber.trim(),
          }
        : {}),
      ...(value.consultationFee !== ""
        ? {
            consultationFee: Number(value.consultationFee),
          }
        : {}),
    };
  }

  if (role === "nurse") {
    return {
      ...common,
      ...(value.ward.trim() ? { ward: value.ward.trim() } : {}),
      shift: value.shift,
    };
  }

  return common;
}

function RoleProfileFields({
  role,
  value,
  onChange,
  departments,
}: {
  role: Role;
  value: ProfileForm;
  onChange: (patch: Partial<ProfileForm>) => void;
  departments: Array<{
    _id: string;
    name: string;
  }>;
}) {
  if (!["doctor", "nurse", "receptionist"].includes(role)) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <Field label="Department">
        <Select
          value={value.departmentId}
          onChange={(event) =>
            onChange({
              departmentId: event.target.value,
            })
          }
        >
          <option value="">None</option>

          {departments.map((department) => (
            <option key={department._id} value={department._id}>
              {department.name}
            </option>
          ))}
        </Select>
      </Field>

      {role === "doctor" && (
        <>
          <Field label="Specialization">
            <Input
              required
              value={value.specialization}
              onChange={(event) =>
                onChange({
                  specialization: event.target.value,
                })
              }
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="License number">
              <Input
                value={value.licenseNumber}
                onChange={(event) =>
                  onChange({
                    licenseNumber: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Consultation fee">
              <Input
                type="number"
                min="0"
                value={value.consultationFee}
                onChange={(event) =>
                  onChange({
                    consultationFee: event.target.value,
                  })
                }
              />
            </Field>
          </div>
        </>
      )}

      {role === "nurse" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ward">
            <Input
              value={value.ward}
              onChange={(event) =>
                onChange({
                  ward: event.target.value,
                })
              }
            />
          </Field>

          <Field label="Shift">
            <Select
              value={value.shift}
              onChange={(event) =>
                onChange({
                  shift: event.target.value as ProfileForm["shift"],
                })
              }
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="night">Night</option>
            </Select>
          </Field>
        </div>
      )}

      {role !== "receptionist" && (
        <Field label="Qualifications (comma separated)">
          <Input
            value={value.qualification}
            onChange={(event) =>
              onChange({
                qualification: event.target.value,
              })
            }
          />
        </Field>
      )}
    </div>
  );
}

function toggle(values: string[], value: string, checked: boolean): string[] {
  return checked
    ? [...new Set([...values, value])]
    : values.filter((item) => item !== value);
}

function errorMessage(error: unknown): string {
  return (
    (
      error as {
        response?: {
          data?: {
            error?: {
              message?: string;
            };
          };
        };
        message?: string;
      }
    )?.response?.data?.error?.message ??
    (error as { message?: string })?.message ??
    "Operation failed"
  );
}

function showError(error: unknown): void {
  toast.error(errorMessage(error));
}
