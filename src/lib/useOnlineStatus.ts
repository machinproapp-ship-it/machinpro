"use client";

import { useEffect, useState } from "react";

export function useOnlineStatus(): { isOnline: boolean; wasOffline: boolean } {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);
    const onOnline = () => {
      setIsOnline(true);
    };
    const onOffline = () => {
      setWasOffline(true);
      setIsOnline(false);
    };
    sync();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
