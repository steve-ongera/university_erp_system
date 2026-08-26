// src/hooks/useNotificationCenter.js
// Adjust the import path below to wherever your api.js actually lives.
import { useCallback, useEffect, useRef, useState } from "react";
import { notificationsApi, communicationApi } from "../services/api";

const POLL_INTERVAL_MS = 20000; // 20s — adjust to taste, 15-30s is the agreed range

export function useNotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [notifRes, inboxRes] = await Promise.all([
        notificationsApi.summary(),
        communicationApi.inbox(),
      ]);
      setNotifications(notifRes.data.results);
      setUnreadCount(notifRes.data.unread_count);
      setInboxUnreadCount(inboxRes.data.unread_count);
    } catch (err) {
      // Deliberately silent in the UI — a failed poll shouldn't surface
      // as a user-facing error; the next tick just tries again.
      console.error("Notification poll failed:", err);
    }
  }, []);

  useEffect(() => {
    refresh(); // fetch immediately on mount, don't wait for the first interval

    const startPolling = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
    };

    // Pause polling in background tabs — no point hammering the API for
    // a navbar the user isn't looking at, and it fixes the classic
    // "23 background tabs all polling every 20s" problem.
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        refresh();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (id) => {
      // Optimistic update so the bell feels instant.
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await notificationsApi.markRead(id);
      } catch (err) {
        console.error("Failed to mark notification read:", err);
        refresh(); // resync with the server on failure
      }
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead();
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
      refresh();
    }
  }, [refresh]);

  return { notifications, unreadCount, inboxUnreadCount, markRead, markAllRead, refresh };
}