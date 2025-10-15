import { useEffect } from "react";

export default function MediaModal({ open, kind, src, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* content */}
      <div className="absolute inset-0 p-4 md:p-8 flex items-center justify-center">
        <div className="relative max-w-6xl w-full max-h-[90vh] rounded-xl overflow-hidden bg-black/40 border border-slate-700 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white text-sm px-3 py-1 rounded"
          >
            Cerrar ✕
          </button>

          <div className="p-2 md:p-4 flex items-center justify-center">
            {kind === "image" && (
              <img
                src={src}
                alt="media"
                className="max-h-[80vh] object-contain"
                draggable={false}
              />
            )}
            {kind === "video" && (
              <video
                src={src}
                controls
                autoPlay
                className="max-h-[80vh] w-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
