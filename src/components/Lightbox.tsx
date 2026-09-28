import { useEffect } from "react";

type LightboxPhoto = {
  url: string;
  fileName: string;
  uploadedBy: string | null;
};

export function Lightbox({
  photo,
  onClose,
}: {
  photo: LightboxPhoto;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.fileName}
      onClick={onClose}
    >
      <figure onClick={(event) => event.stopPropagation()}>
        <img src={photo.url} alt={photo.fileName} />
        <figcaption>
          {photo.uploadedBy ? photo.uploadedBy : photo.fileName}
        </figcaption>
      </figure>
      <button type="button" className="lightbox-close" onClick={onClose}>
        Cerrar
      </button>
    </div>
  );
}
