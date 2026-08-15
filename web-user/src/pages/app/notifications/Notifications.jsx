import { useState, useEffect, useCallback } from "react";
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
  task_invite: { icon: FiCheckSquare, className: "iconTask" },
  task_update: { icon: FiRepeat, className: "iconTask" },
  task_collaborator: { icon: FiUserPlus, className: "iconTask" },
  task_response: { icon: FiCheckCircle, className: "iconResponse" },
  task_reminder: { icon: FiClock, className: "iconReminder" },
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
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFeed = useCallback(
    async (reset = true) => {
      if (reset) setLoading(true);
      setError("");
      try {
        const currentOffset = reset ? 0 : offset;
        const res = await getNotificationFeed({
          filter,
          limit: 15,
          offset: currentOffset,
        });
        if (res.ok) {
          if (reset) {
            setNotifications(res.notifications);
            setOffset(15);
          } else {
            setNotifications((prev) => [...prev, ...res.notifications]);
            setOffset((prev) => prev + 15);
          }
          setUnreadCount(res.unreadCount);
          setHasMore(res.hasMore);
        } else {
          setError("Failed to load notifications.");
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        setError("Unable to load notifications.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [filter],
  );

  useEffect(() => {
    fetchFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleShowMore = () => {
    setLoadingMore(true);
    fetchFeed(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all read:", err);
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
