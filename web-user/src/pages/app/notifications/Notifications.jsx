import { useState, useEffect } from "react";
import { getInvitations } from "../../../api/notifications";
import InvitationModal from "../../../components/events/InvitationModal";
import { FiCalendar, FiClock, FiMapPin, FiUsers } from "react-icons/fi";
import styles from "./Notifications.module.css";

export default function Notifications() {
  const [filterType, setFilterType] = useState("all"); // all | events | tasks | invitations | conflict
  const [contentType, setContentType] = useState(null); // campus | department | private | null
  const [invitations, setInvitations] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (filterType === "invitations" || filterType === "all") {
          // For now only fetch invitations; later we'll add tasks etc.
          params.response = "pending";
          if (contentType) params.type = contentType;
          const data = await getInvitations(params);
          setInvitations(data.events || []);
        } else {
          setInvitations([]);
        }
      } catch (err) {
        console.error("Failed to load invitations:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filterType, contentType]);

  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  return (
    <div className={styles.mainContainer}>
      <div className={styles.filterContainer}>
        <div className={styles.typeContainer}>
          <select
            className={styles.filterSelect}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All</option>
            <option value="events">Events</option>
            <option value="tasks">Tasks</option>
            <option value="invitations">Invitations</option>
            <option value="conflict">Conflict</option>
          </select>
        </div>
        <div className={styles.btnContainer}>
          <button
            className={`${styles.filterBtn} ${contentType === "campus" ? styles.activeBtn : ""}`}
            onClick={() =>
              setContentType(contentType === "campus" ? null : "campus")
            }
          >
            Campus
          </button>
          <button
            className={`${styles.filterBtn} ${contentType === "department" ? styles.activeBtn : ""}`}
            onClick={() =>
              setContentType(contentType === "department" ? null : "department")
            }
          >
            Department
          </button>
          <button
            className={`${styles.filterBtn} ${contentType === "private" ? styles.activeBtn : ""}`}
            onClick={() =>
              setContentType(contentType === "private" ? null : "private")
            }
          >
            Private
          </button>
        </div>
      </div>

      <div className={styles.mainContent}>
        {loading && <p>Loading invitations...</p>}
        {!loading && invitations.length === 0 && <p>No pending invitations.</p>}
        {invitations.map((event) => (
          <div
            key={event.id}
            className={styles.eventCard}
            onClick={() => handleEventClick(event)}
          >
            <div className={styles.cardHeader}>
              <span className={styles.eventTitle}>{event.title}</span>
              <span className={styles.eventVisibility}>{event.visibility}</span>
            </div>
            <div className={styles.cardDetails}>
              <span>
                <FiCalendar />{" "}
                {new Date(event.start_datetime).toLocaleDateString()}
              </span>
              <span>
                <FiClock />{" "}
                {new Date(event.start_datetime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                -{" "}
                {new Date(event.end_datetime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span>
                <FiMapPin /> {event.venue || event.location || "Online"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedEvent && (
        <InvitationModal
          isOpen={!!selectedEvent}
          event={selectedEvent}
          onClose={handleCloseModal}
          onRespond={() => {
            // Refresh list after respond
            setInvitations((prev) =>
              prev.filter((e) => e.id !== selectedEvent.id),
            );
            handleCloseModal();
          }}
        />
      )}
    </div>
  );
}
