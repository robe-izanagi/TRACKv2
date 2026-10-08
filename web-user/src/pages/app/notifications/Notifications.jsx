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
  const [actionError, setActionError] = useState("");

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
