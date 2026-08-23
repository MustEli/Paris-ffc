import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  changeUserRole,
  createUser,
  getUser,
  listUsers,
  removeUser,
  type CreateUserInput,
  type PublicUser,
} from '../../../core/api/users';
import { useAuthStore } from '../../../core/auth/authStore';

const ALL_USERS_KEY = ['users', 'all'];
const STAFF_USERS_KEY = ['users', 'staff']; // shared with core/hooks/useStaffUsers — keep the assign-to-staff pickers in sync
const userKey = (id: string) => ['users', id];

export function useAllUsers() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ALL_USERS_KEY,
    queryFn: () => listUsers(token!),
    enabled: !!token,
  });
}

export function useUser(id: string) {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: userKey(id),
    queryFn: () => getUser(token!, id),
    enabled: !!token && !!id,
  });
}

function invalidateUserLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ALL_USERS_KEY });
  queryClient.invalidateQueries({ queryKey: STAFF_USERS_KEY });
}

export function useCreateUser() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(token!, input),
    onSuccess: () => invalidateUserLists(queryClient),
  });
}

export function useRemoveUser() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeUser(token!, id),
    onSuccess: (_data, id) => {
      invalidateUserLists(queryClient);
      queryClient.invalidateQueries({ queryKey: userKey(id) });
    },
  });
}

export function useChangeUserRole() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: PublicUser['role'] }) => changeUserRole(token!, id, role),
    onSuccess: (_data, { id }) => {
      invalidateUserLists(queryClient);
      queryClient.invalidateQueries({ queryKey: userKey(id) });
    },
  });
}
