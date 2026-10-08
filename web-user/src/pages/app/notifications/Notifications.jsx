import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCalendar,
  FiCheckSquare,
  FiBell,
  FiUserPlus,
  FiRepeat,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiArchive,
  FiTrash2,
  FiPaperclip,
  FiMapPin,
  FiMessageCircle,
  FiUserMinus,
} from "react-icons/fi";
import {
  getNotificationFeed,
  markNotificationRead,
  markAllNotificationsRead,
  getPushPublicKey,
  savePushSubscription,
  removePushSubscription,
} from "../../../api/notifications";
import styles from "./Notifications.module.css";

const TYPE_CONFIG = {
  event_invite: { icon: FiCalendar, className: "iconEvent" },
  event_update: { icon: FiRepeat, className: "iconEvent" },
  event_collaborator: { icon: FiUserPlus, className: "iconEvent" },
  event_response: { icon: FiCheckCircle, className: "iconResponse" },
  event_reminder: { icon: FiClock, className: "iconReminder" },
  event_archived: { icon: FiArchive, className: "iconSystem" },
  event_deleted: { icon: FiTrash2, className: "iconSystem" },
  event_attendee_removed: { icon: FiUserMinus, className: "iconSystem" },
  event_collaborator_removed: { icon: FiUserMinus, className: "iconSystem" },
  event_attachment_added: { icon: FiPaperclip, className: "iconEvent" },
  event_venue_changed: { icon: FiMapPin, className: "iconEvent" },
  event_venue_archived: { icon: FiMapPin, className: "iconSystem" },
  task_invite: { icon: FiCheckSquare, className: "iconTask" },
  task_update: { icon: FiRepeat, className: "iconTask" },
  task_collaborator: { icon: FiUserPlus, className: "iconTask" },
  task_response: { icon: FiCheckCircle, className: "iconResponse" },
  task_reminder: { icon: FiClock, className: "iconReminder" },
  task_archived: { icon: FiArchive, className: "iconSystem" },
  task_deleted: { icon: FiTrash2, className: "iconSystem" },
  task_assignee_removed: { icon: FiUserMinus, className: "iconSystem" },
  task_collaborator_removed: { icon: FiUserMinus, className: "iconSystem" },
  task_checklist_completed: { icon: FiCheckCircle, className: "iconResponse" },
  task_checklist_reopened: { icon: FiRepeat, className: "iconTask" },
  task_checklist_comment: { icon: FiMessageCircle, className: "iconTask" },
  task_attachment_added: { icon: FiPaperclip, className: "iconTask" },
  profile_change_approved: { icon: FiCheckCircle, className: "iconResponse" },
  profile_change_rejected: { icon: FiXCircle, className: "iconSystem" },
  system: { icon: FiBell, className: "iconSystem" },
};

const decodeVapidKey = (key) => {
  const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const formatRelativeTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function Notifications() {
  const navigate = useNavigate();

  const [filter, setFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const offsetRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pushStatus, setPushStatus] = useState("checking");
  const [pushMessage, setPushMessage] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let active = true;
    const checkPushStatus = async () => {
      if (
        !window.isSecureContext
        || !("Notification" in window)
        || !("serviceWorker" in navigator)
        || !("PushManager" in window)
      ) {
        if (active) setPushStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setPushStatus("blocked");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (active) setPushStatus(subscription ? "enabled" : "disabled");
      } catch (checkError) {
        console.error("Could not check browser push status:", checkError);
        if (active) setPushStatus("error");
      }
    };
    checkPushStatus();
    return () => {
      active = false;
    };
  }, []);

  const fetchFeed = useCallback(
    async (reset = true) => {
      if (reset) setLoading(true);
      setError("");
      try {
        const currentOffset = reset ? 0 : offsetRef.current;
        const res = await getNotificationFeed({
          filter,
          limit: 15,
          offset: currentOffset,
        });
        if (res.ok) {
          if (reset) {
            setNotifications(res.notifications);
            offsetRef.current = 15;
          } else {
            setNotifications((prev) => [...prev, ...res.notifications]);
            offsetRef.current += 15;
          }
          setUnreadCount(res.unreadCount);
          setHasMore(res.hasMore);
        } else {
          setError(res.message || "We could not load notifications. Please try again.");
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        setError(err.response?.data?.message || err.message || "Unable to load notifications. Check your connection and try again.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    const loadNotifications = async () => {
      await fetchFeed(true);
    };
    loadNotifications();
  }, [fetchFeed]);

  const handleShowMore = () => {
    setLoadingMore(true);
    fetchFeed(false);
  };

  const handleMarkAllRead = async () => {
    setActionError("");
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all read:", err);
      setActionError(err.response?.data?.message || err.message || "We could not mark notifications as read. Please try again.");
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Failed to mark notification read:", err);
        setActionError(err.response?.data?.message || err.message || "We could not update this notification. Please try again.");
      }
    }

    const isProfileChangeNotification =
      notif.type === "profile_change_approved" ||
      notif.type === "profile_change_rejected";

    if (isProfileChangeNotification) {
      navigate("/profile");
      window.location.reload();
      return;
    }

    if (notif.entity_type === "event") navigate("/events");
    else if (notif.entity_type === "task") navigate("/tasks");
  };

  const handlePushToggle = async () => {
    setPushMessage("");
    const previousStatus = pushStatus;
    setPushStatus("working");
    try {
      if (previousStatus === "enabled") {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await removePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setPushStatus("disabled");
        setPushMessage("Browser push notifications are off on this device.");
        return;
      }

      if (Notification.permission === "denied") {
        setPushStatus("blocked");
        setPushMessage("Notifications are blocked by your browser. Allow them for this site in browser settings, then try again.");
        return;
      }
      const keyResponse = await getPushPublicKey();
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus(permission === "denied" ? "blocked" : "disabled");
        setPushMessage(permission === "denied"
          ? "Notifications are blocked by your browser. Allow them for this site in browser settings, then try again."
          : "Browser permission was not granted. TRACK will continue to show notifications in the app.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(keyResponse.publicKey),
        });
      }
      await savePushSubscription(subscription.toJSON());
      setPushStatus("enabled");
      setPushMessage("Browser push notifications are enabled on this device.");
    } catch (pushError) {
      console.error("Could not update browser push settings:", pushError);
      setPushStatus(previousStatus === "enabled" ? "enabled" : "disabled");
      setPushMessage(pushError.response?.data?.message || pushError.message || "We could not update browser notification settings. Please try again.");
    }
  };

  const pushStatusText = {
    checking: "Checking this browser's notification settings...",
    enabled: "Enabled on this browser. TRACK can show notifications even when the app is not open.",
    disabled: "Disabled on this browser. Notifications will still appear in the TRACK app.",
    blocked: "Blocked by your browser. Allow notifications for this site in browser settings to enable push.",
    unsupported: "Browser push requires a supported browser and a secure (HTTPS) connection.",
    error: "We could not check this browser's notification settings. You can try again below.",
    working: "Updating browser notification settings...",
  }[pushStatus];

  return (
    <div className={styles.mainContainer}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Notifications</h1>
        {unreadCount > 0 && (
          <button
            type="button"
            className={styles.markAllBtn}
            onClick={handleMarkAllRead}
          >
            Mark all read
          </button>
        )}
      </div>

      <section className={styles.pushSettings} aria-label="Browser push notifications">
        <div className={styles.pushCopy}>
          <h2>Browser push notifications</h2>
          <p>{pushStatusText}</p>
          {pushMessage && <p className={styles.pushMessage} role="status">{pushMessage}</p>}
        </div>
        {pushStatus !== "unsupported" && pushStatus !== "checking" && pushStatus !== "working" && (
          <button
            type="button"
            className={styles.pushButton}
            onClick={handlePushToggle}
            aria-pressed={pushStatus === "enabled"}
          >
            {pushStatus === "enabled" ? "Turn off" : pushStatus === "blocked" ? "Check again" : pushStatus === "error" ? "Try again" : "Enable"}
          </button>
        )}
      </section>

      {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}

      <div className={styles.filterContainer}>
        <button
          type="button"
          className={`${styles.filterBtn} ${filter === "all" ? styles.activeBtn : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${filter === "unread" ? styles.activeBtn : ""}`}
          onClick={() => setFilter("unread")}
        >
          Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
        </button>
      </div>

      <div className={styles.mainContent}>
        {loading ? (
          <p className={styles.loading}>Loading notifications...</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <FiBell size={36} className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              {filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </p>
            <p className={styles.emptySubtext}>
              You'll see invitations, updates, and reminders here.
            </p>
          </div>
        ) : (
          <>
            {notifications.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
              const Icon = cfg.icon;
              return (
                <div
                  key={notif.id}
                  className={`${styles.notifCard} ${!notif.is_read ? styles.notifUnread : ""}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <span
                    className={`${styles.notifIcon} ${styles[cfg.className]}`}
                  >
                    <Icon size={16} />
                  </span>
                  <div className={styles.notifBody}>
                    <div className={styles.notifTopRow}>
                      <span className={styles.notifTitle}>{notif.title}</span>
                      <span className={styles.notifTime}>
                        {formatRelativeTime(notif.created_at)}
                      </span>
                    </div>
                    {notif.message && (
                      <p className={styles.notifMessage}>{notif.message}</p>
                    )}
                  </div>
                  {!notif.is_read && <span className={styles.unreadDot} />}
                </div>
              );
            })}

            {hasMore && (
              <div className={styles.showMoreWrapper}>
                <button
                  className={styles.showMoreBtn}
                  onClick={handleShowMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Show More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
