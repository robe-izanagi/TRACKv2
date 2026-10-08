import { FiArchive, FiClock, FiMapPin, FiUsers } from "react-icons/fi";
import Modal from "../common/Modal";
import eventStyles from "./EventCardView.module.css";
import styles from "./ArchivedEventView.module.css";

const responseLabel = (response) => {
  if (response === "accepted") return "Accepted";
  if (response === "declined") return "Declined";
  return "Pending";
};

export default function ArchivedEventView({ event, onClose, onUseTemplate }) {
  if (!event) return null;

  const location = event.method === "online"
    ? "Online event"
    : event.venue || event.location || "Location undecided";

  return (
    <Modal isOpen={!!event} onClose={onClose} title={event.title}>
      <div className={eventStyles.featuredCardContent}>
        <div className={eventStyles.badgeRow}>
          <span className={eventStyles.badgePill}>{event.hierarchy || "Event"}</span>
          <span className={eventStyles.badgePill}>
            {event.method === "online" ? "Online" : "Face-to-face"}
          </span>
          {event.visibility && <span className={eventStyles.badgePill}>{event.visibility}</span>}
          {event.event_type && <span className={eventStyles.badgePill}>{event.event_type}</span>}
        </div>

        <div className={styles.archiveNotice}>
          <FiArchive size={16} />
          <span>This event is archived. Its dates, event link, collaborators, and attachments are not available.</span>
        </div>

        <p className={eventStyles.descriptionText}>
          {event.description || "No description provided."}
        </p>

        <section className={eventStyles.whenWhereGroup}>
          <div className={eventStyles.sectionHeader}>
            <FiClock size={18} />
            <div className={eventStyles.heading4}>
              <div className={eventStyles.text7}>TIME &amp; LOCATION</div>
            </div>
          </div>
          <div className={eventStyles.infoGrid}>
            <div className={eventStyles.infoBlock}>
              <div className={eventStyles.infoLabel}>TIME</div>
              <div className={eventStyles.infoValue}>
                {event.start_time || "Not set"} — {event.end_time || "Not set"}
              </div>
            </div>
            <div className={eventStyles.infoBlock}>
              <div className={eventStyles.infoLabel}>LOCATION</div>
              <div className={eventStyles.infoValue}>
                <FiMapPin size={14} /> {location}
              </div>
            </div>
          </div>
        </section>

        <section className={eventStyles.audienceSection}>
          <div className={eventStyles.sectionHeader}>
            <FiUsers size={18} />
            <div className={eventStyles.heading4}>
              <div className={eventStyles.text7}>INVITED ATTENDEES</div>
            </div>
            <span className={styles.attendeeCount}>{event.attendees?.length || 0}</span>
          </div>
          {event.attendees?.length ? (
            <ul className={styles.attendeeList}>
              {event.attendees.map((attendee) => (
                <li key={attendee.id} className={styles.attendee}>
                  <span className={styles.attendeeName}>{attendee.name}</span>
                  <span className={`${styles.response} ${styles[attendee.response || "pending"]}`}>
                    {responseLabel(attendee.response)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.noAttendees}>No invited attendees.</p>
          )}
        </section>

        <div className={styles.actions}>
          <button type="button" className={styles.templateButton} onClick={onUseTemplate}>
            Use as template
          </button>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
