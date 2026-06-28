import { useState } from "react";
import Modal from "../common/Modal";
import { respondToInvitation } from "../../api/notifications";
import {
  FiCalendar,
  FiClock,
  FiEye,
  FiMapPin,
  FiUser,
  FiUsers,
  FiPaperclip,
  FiCheck,
  FiX,
  FiDownload,
  FiChevronDown,
} from "react-icons/fi";
import styles from "./InvitationModal.module.css";

export default function InvitationModal({ isOpen, event, onClose, onRespond }) {
  const [showAllDept, setShowAllDept] = useState(false);
  const [showAllOffice, setShowAllOffice] = useState(false);
  const [showAllUser, setShowAllUser] = useState(false);
  const [responding, setResponding] = useState(false);

  // Simulate participants data (in production, you'd fetch from event attendees)
  const participants = event.participants || {
    departments: [],
    offices: [],
    users: [],
  };

  const handleResponse = async (response) => {
    setResponding(true);
    try {
      await respondToInvitation(event.id, response);
      onRespond();
    } catch (err) {
      console.error("Failed to respond:", err);
    } finally {
      setResponding(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className={styles.mainContent}>
        <div className={styles.titleSection}>
          <h2>{event.title}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <FiCalendar />{" "}
            {new Date(event.start_datetime).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            -{" "}
            {new Date(event.end_datetime).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <div className={styles.detailItem}>
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
          </div>
          <div className={styles.detailItem}>
            <FiEye /> {event.visibility}
          </div>
          <div className={styles.detailItem}>
            <FiMapPin /> {event.venue || event.location || "Online"}
          </div>
          <div className={styles.detailItem}>
            <FiUser /> {event.method}
          </div>
        </div>

        {/* Accept / Decline */}
        {event.response === "pending" && (
          <div className={styles.responseSection}>
            <p>You have been invited to this event. Accept or Decline?</p>
            <div className={styles.responseBtns}>
              <button
                className={styles.acceptBtn}
                onClick={() => handleResponse("accepted")}
                disabled={responding}
              >
                <FiCheck /> Accept
              </button>
              <button
                className={styles.declineBtn}
                onClick={() => handleResponse("declined")}
                disabled={responding}
              >
                <FiX /> Decline
              </button>
            </div>
          </div>
        )}

        {/* Description */}
        <div className={styles.section}>
          <h3>
            <FiCalendar /> Description
          </h3>
          <p>{event.description || "No description provided."}</p>
        </div>

        {/* Participants */}
        <div className={styles.section}>
          <h3>
            <FiUsers /> Participants
          </h3>
          <div className={styles.partGroup}>
            <h4>Departments</h4>
            <div className={styles.partList}>
              {participants.departments
                .slice(0, showAllDept ? undefined : 3)
                .map((dept) => (
                  <span key={dept} className={styles.partTag}>
                    {dept}
                  </span>
                ))}
              {participants.departments.length > 3 && (
                <button
                  className={styles.showMoreBtn}
                  onClick={() => setShowAllDept(!showAllDept)}
                >
                  {showAllDept ? "Show less" : "Show all"} <FiChevronDown />
                </button>
              )}
            </div>
          </div>
          <div className={styles.partGroup}>
            <h4>Offices</h4>
            <div className={styles.partList}>
              {participants.offices
                .slice(0, showAllOffice ? undefined : 3)
                .map((office) => (
                  <span key={office} className={styles.partTag}>
                    {office}
                  </span>
                ))}
              {participants.offices.length > 3 && (
                <button
                  className={styles.showMoreBtn}
                  onClick={() => setShowAllOffice(!showAllOffice)}
                >
                  {showAllOffice ? "Show less" : "Show all"} <FiChevronDown />
                </button>
              )}
            </div>
          </div>
          <div className={styles.partGroup}>
            <h4>Users</h4>
            <div className={styles.partList}>
              {participants.users
                .slice(0, showAllUser ? undefined : 3)
                .map((user) => (
                  <span key={user.id} className={styles.partTag}>
                    <FiUser size={12} /> {user.name}
                  </span>
                ))}
              {participants.users.length > 3 && (
                <button
                  className={styles.showMoreBtn}
                  onClick={() => setShowAllUser(!showAllUser)}
                >
                  {showAllUser ? "Show less" : "Show all"} <FiChevronDown />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Attachments */}
        {event.attachments && event.attachments.length > 0 && (
          <div className={styles.section}>
            <h3>
              <FiPaperclip /> Attachments
            </h3>
            <div className={styles.attachList}>
              {event.attachments.map((file) => (
                <a
                  key={file.id}
                  href={file.file_url}
                  download
                  className={styles.attachItem}
                >
                  <FiDownload size={14} /> {file.file_name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Archive button */}
        <div className={styles.archiveSection}>
          <button className={styles.archiveBtn}>Archive</button>
        </div>
      </div>
    </Modal>
  );
}
