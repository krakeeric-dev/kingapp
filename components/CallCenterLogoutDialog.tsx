export function CallCenterLogoutDialog({
  onCancel,
  onLogout
}: {
  onCancel: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#061b33] p-6 text-white shadow-2xl">
        <h2 className="text-xl font-black">Are you sure you want to logout?</h2>
        <p className="mt-2 text-sm font-semibold text-blue-100">
          Your Call Center session will close and you will return to login.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-black text-white transition hover:bg-red-600"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </section>
    </div>
  );
}
