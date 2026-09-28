import { useMutation, useQuery } from "convex/react";
import { Component, useCallback, useRef, useState, type DragEvent, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MomentId } from "../data/itinerary.ts";
import { prepareImage } from "../lib/prepareImage.ts";
import { Lightbox } from "./Lightbox.tsx";

const MAX_BATCH = 30;
const PREVIEW_COUNT = 6;

type Photo = {
  _id: Id<"photos">;
  fileName: string;
  uploadedBy: string | null;
  driveStatus: "pendiente" | "en_drive" | "sin_carpeta" | "error";
  createdAt: number;
  canRemove: boolean;
  url: string | null;
};

class AlbumBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="album-note">El álbum no está disponible ahora.</p>
      );
    }
    return this.props.children;
  }
}

export function Album({
  slug,
  connected,
  isAdmin,
  uploaderName,
  named,
}: {
  slug: MomentId;
  connected: boolean;
  isAdmin: boolean;
  uploaderName: string;
  named: boolean;
}) {
  return (
    <AlbumBoundary>
      {connected ? (
        <AlbumLive
          slug={slug}
          isAdmin={isAdmin}
          uploaderName={uploaderName}
          named={named}
        />
      ) : (
        <AlbumOffline />
      )}
    </AlbumBoundary>
  );
}

function AlbumIntro({ count }: { count?: number }) {
  return (
    <div className="album-head">
      <h3>Álbum</h3>
      <p>
        {typeof count === "number" && count > 0
          ? `${count} ${count === 1 ? "foto" : "fotos"}`
          : "Todavía no hay fotos"}
      </p>
    </div>
  );
}

function AlbumOffline() {
  return (
    <section className="album">
      <AlbumIntro />
      <p className="album-note">
        El álbum se activa cuando Convex está corriendo.
      </p>
    </section>
  );
}

function AlbumLive({
  slug,
  isAdmin,
  uploaderName,
  named,
}: {
  slug: MomentId;
  isAdmin: boolean;
  uploaderName: string;
  named: boolean;
}) {
  const photos = useQuery(api.photos.list, { itinerarySlug: slug }) as
    | Photo[]
    | undefined;
  const windows = useQuery(api.photos.windows);
  const windowForMoment = windows?.[slug];
  const uploadsOpen = windowForMoment?.open === true;
  const connection = useQuery(api.photos.connection);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const savePhoto = useMutation(api.photos.savePhoto);
  const removePhoto = useMutation(api.photos.remove);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<Photo | null>(null);
  const close = useCallback(() => setOpen(null), []);

  async function handleFiles(incoming: File[]) {
    const images = incoming.filter(
      (file) =>
        file.type.startsWith("image/") ||
        /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name),
    );
    if (images.length === 0) {
      setMessage("Elegí fotos, no otros archivos.");
      return;
    }
    const batch = images.slice(0, MAX_BATCH);
    const skipped = images.length - batch.length;
    setBusy(true);
    let failed = 0;
    for (let index = 0; index < batch.length; index += 1) {
      setMessage(`Subiendo ${index + 1} de ${batch.length}…`);
      try {
        const file = await prepareImage(batch[index]);
        const uploadUrl = await generateUploadUrl({ itinerarySlug: slug });
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error("upload");
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        await savePhoto({
          itinerarySlug: slug,
          storageId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        });
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    if (failed > 0) {
      setMessage(
        failed === 1
          ? "Una foto no se pudo subir. Probá de nuevo."
          : `${failed} fotos no se pudieron subir.`,
      );
    } else if (skipped > 0) {
      setMessage(`Subí ${batch.length}. El resto, de a ${MAX_BATCH}.`);
    } else {
      setMessage("Listo. Ya están en el álbum.");
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    void handleFiles([...event.dataTransfer.files]);
  }

  async function onRemove(photo: Photo) {
    const confirmed = window.confirm(
      "¿Sacamos esta foto del álbum y de Drive?",
    );
    if (!confirmed) return;
    await removePhoto({ photoId: photo._id });
    if (open?._id === photo._id) setOpen(null);
  }

  const visible = expanded ? photos : photos?.slice(0, PREVIEW_COUNT);
  const folderLink = isAdmin ? connection?.links[slug] : null;

  return (
    <section className="album">
      <AlbumIntro count={photos?.length} />
      {uploadsOpen && named ? (
        <p className="album-note">Se guardan como {uploaderName}.</p>
      ) : uploadsOpen ? (
        <p className="album-note">
          Confirmá tu nombre y apellido para sumar fotos.
        </p>
      ) : (
        <p className="album-note">
          Las fotos se abren {windowForMoment?.from ?? "el día del momento"}.
        </p>
      )}
      {uploadsOpen && named && (
      <div
        className={over ? "drop is-over" : "drop"}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          className="file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            const files = event.target.files ? [...event.target.files] : [];
            event.target.value = "";
            void handleFiles(files);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Subiendo…" : "Sumar fotos"}
        </button>
        <span>o arrastralas acá</span>
      </div>
      )}
      <p className="album-status" aria-live="polite">
        {message}
      </p>
      {photos === undefined ? (
        <p className="album-note">Cargando el álbum…</p>
      ) : photos.length === 0 ? (
        <p className="album-note">
          {uploadsOpen
            ? "Cuando pase este momento, dejá acá las fotos."
            : "Hasta ese día, el álbum espera."}
        </p>
      ) : (
        <>
          <ul className="thumbs">
            {visible?.map((photo) => (
              <li key={photo._id} className="thumb">
                <button
                  type="button"
                  className="thumb-open"
                  onClick={() => photo.url && setOpen(photo)}
                  disabled={!photo.url}
                >
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={
                        photo.uploadedBy
                          ? `Foto de ${photo.uploadedBy}`
                          : photo.fileName
                      }
                    />
                  ) : (
                    <span className="thumb-missing">Sin vista previa</span>
                  )}
                  {photo.uploadedBy && (
                    <span className="thumb-name">{photo.uploadedBy}</span>
                  )}
                </button>
                {photo.driveStatus === "en_drive" && (
                  <span className="saved" title="También en Drive" />
                )}
                {isAdmin && photo.driveStatus === "pendiente" && (
                  <span className="saved saved-wait" title="Subiendo a Drive" />
                )}
                {isAdmin && photo.driveStatus === "error" && (
                  <span
                    className="saved saved-error"
                    title="Drive no la recibió"
                  />
                )}
                {photo.canRemove && (
                  <button
                    type="button"
                    className="thumb-remove"
                    onClick={() => void onRemove(photo)}
                  >
                    Quitar
                  </button>
                )}
              </li>
            ))}
          </ul>
          {photos.length > PREVIEW_COUNT && (
            <button
              type="button"
              className="text-button"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Ver menos" : `Ver las ${photos.length} fotos`}
            </button>
          )}
        </>
      )}
      {folderLink && (
        <p className="album-actions">
          <a href={folderLink} target="_blank" rel="noreferrer">
            Abrir carpeta de Drive
          </a>
        </p>
      )}
      {open?.url && (
        <Lightbox
          photo={{
            url: open.url,
            fileName: open.fileName,
            uploadedBy: open.uploadedBy,
          }}
          onClose={close}
        />
      )}
    </section>
  );
}
