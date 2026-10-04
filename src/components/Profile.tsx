import { NameForm } from "./NameForm.tsx";

export function Profile({
  email,
  image,
  displayName,
  profileName,
  firstName,
  lastName,
  isBride,
  isAdmin,
  canPreview,
  previewing,
  onPreview,
  hasName,
  onReady,
}: {
  email: string;
  image: string;
  displayName: string;
  profileName: string;
  firstName: string;
  lastName: string;
  isBride: boolean;
  isAdmin: boolean;
  canPreview: boolean;
  previewing: boolean;
  onPreview: () => void;
  hasName: boolean;
  onReady?: () => void;
}) {
  const title = displayName || profileName || "Tu perfil";
  const initial = title.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <header className="hero">
        {image ? (
          <img
            className="avatar"
            src={image}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="avatar avatar-fallback" aria-hidden="true">
            {initial}
          </span>
        )}
        <p className="eyebrow">Tu Gmail</p>
        <h1 className="profile-name">{title}</h1>
        <p className="profile-mail">{email}</p>
        {(isBride || isAdmin) && (
          <p className="profile-role">
            {previewing || (isBride && !canPreview) ? "Novia" : "Organizás la despedida"}
          </p>
        )}
        {canPreview && (
          <button type="button" className="pill-button preview-toggle" onClick={onPreview}>
            {previewing ? "Volver a mi vista" : "Ver como la novia"}
          </button>
        )}
      </header>
      <NameForm
        intent={hasName ? "edit" : "confirm"}
        profileName={profileName}
        initialFirst={firstName}
        initialLast={lastName}
        onDone={onReady}
      />
    </>
  );
}
