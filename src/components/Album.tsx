import { useAction, useMutation, useQuery } from "convex/react";
import { Component, useCallback, useRef, useState, type DragEvent, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MomentId } from "../data/itinerary.ts";
import { prepareImage } from "../lib/prepareImage.ts";
import { Lightbox } from "./Lightbox.tsx";
import { said } from "../lib/said.ts";
import { useToast } from "./Toaster.tsx";

const MAX_BATCH = 30;
const PREVIEW_COUNT = 6;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

type Photo = {
  _id: Id<"photos">;
  fileName: string;
  uploadedBy: string | null;
  driveStatus: "pendiente" | "en_drive" | "sin_carpeta" | "error";
  createdAt: number;
  canRemove: boolean;
  video: boolean;
  url: string | null;
};

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm|3gp)$/i.test(file.name);
}

function isImageFile(file: File) {
  return (
    file.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name)
  );
}

function albumLabel(photos: Photo[]) {
  if (photos.length === 0) return "Todavía no hay fotos";
  const videos = photos.filter((photo) => photo.video).length;
  const images = photos.length - videos;
  if (videos === 0) return `${images} ${images === 1 ? "foto" : "fotos"}`;
  if (images === 0) return `${videos} ${videos === 1 ? "video" : "videos"}`;
  return `${photos.length} en el álbum`;
}

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
  preview = false,
  uploaderName,
  named,
}: {
  slug: MomentId;
  connected: boolean;
  isAdmin: boolean;
  preview?: boolean;
  uploaderName: string;
  named: boolean;
}) {
  return (
    <AlbumBoundary>
      {connected ? (
        <AlbumLive
          slug={slug}
          isAdmin={isAdmin}
          preview={preview}
          uploaderName={uploaderName}
          named={named}
        />
      ) : (
        <AlbumOffline />
      )}
    </AlbumBoundary>
  );
}

function AlbumIntro({ label }: { label?: string }) {
  return (
    <div className="album-head">
      <h3>Álbum</h3>
      <p>{label ?? "Todavía no hay fotos"}</p>
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
  preview,
  uploaderName,
  named,
}: {
  slug: MomentId;
  isAdmin: boolean;
  preview: boolean;
  uploaderName: string;
  named: boolean;
}) {
  const photos = useQuery(api.photos.list, { itinerarySlug: slug }) as
    | Photo[]
    | undefined;
  const windows = useQuery(api.photos.windows);
  const windowForMoment = windows?.[slug];
  const uploadsOpen = (preview ? windowForMoment?.openForGuests : windowForMoment?.open) === true;
  const uploadsLocked = windowForMoment?.locked === true;
  const connection = useQuery(api.photos.connection);
  const publish = useAction(api.drive.publish);
  const signVideo = useAction(api.r2.signVideo);
  const commitVideo = useAction(api.r2.commitVideo);
  const removePhoto = useMutation(api.photos.remove);
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<Photo | null>(null);
  const close = useCallback(() => setOpen(null), []);

  async function uploadVideo(file: File) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error("pesado");
    const signed = await signVideo({
      itinerarySlug: slug,
      fileName: file.name,
      contentType: file.type || "video/mp4",
    });
    const put = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": signed.contentType },
      body: file,
    });
    if (!put.ok) throw new Error("subida");
    await commitVideo({
      itinerarySlug: slug,
      key: signed.key,
      fileName: file.name,
      contentType: signed.contentType,
    });
  }

  async function handleFiles(incoming: File[]) {
    const media = incoming.filter((file) => isImageFile(file) || isVideoFile(file));
    if (media.length === 0) {
      toast.error("Elegí fotos o videos.");
      return;
    }
    const batch = media.slice(0, MAX_BATCH);
    const skipped = media.length - batch.length;
    setBusy(true);
    let failed = 0;
    let heavy = 0;
    for (const item of batch) {
      try {
        if (isVideoFile(item)) {
          await uploadVideo(item);
          continue;
        }
        const file = await prepareImage(item);
        if (file.size > 8_000_000) throw new Error("pesada");
        await publish({
          itinerarySlug: slug,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          bytes: await file.arrayBuffer(),
        });
      } catch (caught) {
        failed += 1;
        if (caught instanceof Error && caught.message === "pesado") heavy += 1;
      }
    }
    setBusy(false);
    if (heavy > 0 && heavy === failed) {
      toast.error("El video es muy pesado. Probá con uno más corto.");
    } else if (failed > 0) {
      toast.error(
        failed === 1
          ? "Uno no se pudo subir. Probá de nuevo."
          : `${failed} no se pudieron subir.`,
      );
    } else if (skipped > 0) {
      toast.note(`Subí ${batch.length}. El resto, de a ${MAX_BATCH}.`);
    } else {
      toast.ok("Listo. Quedó en el álbum.");
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    void handleFiles([...event.dataTransfer.files]);
  }

  function onRemove(photo: Photo) {
    toast.ask(photo.video ? "¿Sacamos este video del álbum?" : "¿Sacamos esta foto del álbum y de Drive?", () => {
      void removePhoto({ photoId: photo._id })
        .then(() => {
          if (open?._id === photo._id) setOpen(null);
          toast.ok(photo.video ? "Video sacado." : "Foto sacada.");
        })
        .catch((caught: unknown) => {
          toast.error(said(caught, "No se pudo sacar la foto."));
        });
    }, "Sacar", "Dejarla");
  }

  const visible = expanded ? photos : photos?.slice(0, PREVIEW_COUNT);
  const folderLink = connection?.links[slug] ?? null;

  return (
    <section className="album">
      <AlbumIntro label={photos ? albumLabel(photos) : undefined} />
      {uploadsLocked ? (
        <p className="album-note">La organizadora cerró la subida de fotos.</p>
      ) : uploadsOpen && named ? (
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
      {uploadsOpen && named && !uploadsLocked && (
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
          accept="image/*,video/*"
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
          {busy ? "Subiendo…" : "Sumar fotos y videos"}
        </button>
        <span>o arrastralos acá</span>
      </div>
      )}
      {photos === undefined ? (
        <p className="album-note">Cargando el álbum…</p>
      ) : photos.length === 0 && !uploadsLocked ? (
        <p className="album-note">
          {uploadsOpen
            ? "Cuando pase este momento, dejá acá las fotos y los videos."
            : "Hasta ese día, el álbum espera."}
        </p>
      ) : photos.length === 0 ? null : (
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
                  {photo.url && photo.video ? (
                    <>
                      <video
                        src={`${photo.url}#t=0.1`}
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <span className="thumb-play" aria-hidden="true" />
                    </>
                  ) : photo.url ? (
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
                  <span className="saved" title="En el álbum" />
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
                {!preview && photo.canRemove && (
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
              {expanded ? "Ver menos" : `Ver los ${photos.length}`}
            </button>
          )}
        </>
      )}
      {folderLink && (
        <p className="album-actions">
          <a href={folderLink} target="_blank" rel="noreferrer">
            Ver Drive
          </a>
        </p>
      )}
      {open?.url && (
        <Lightbox
          photo={{
            url: open.url,
            fileName: open.fileName,
            uploadedBy: open.uploadedBy,
            video: open.video,
          }}
          onClose={close}
        />
      )}
    </section>
  );
}
