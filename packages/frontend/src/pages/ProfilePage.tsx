import { useAuthStore } from '@/stores/auth-store';

export default function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h2 className="text-lg font-semibold">Profile</h2>
      <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-medium">
          {user?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="font-medium">{user?.name}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Avatar upload and profile editing will be available in Phase 6.
      </p>
    </div>
  );
}
