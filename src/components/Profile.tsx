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
            {isBride ? "Novia" : "Organizás la despedida"}
          </p>
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
