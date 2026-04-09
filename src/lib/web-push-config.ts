import webpush from "web-push";

let configured = false;

export function configureWebPush(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const email = process.env.VAPID_EMAIL?.trim();
  const subject =
    email && email.includes("@")
      ? email.startsWith("mailto:")
        ? email
        : `mailto:${email}`
      : process.env.VAPID_MAILTO?.trim() || "mailto:support@machin.pro";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}
