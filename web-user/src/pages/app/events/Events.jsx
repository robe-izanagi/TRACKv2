import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useEventsFilter } from "../../../context/EventsFilterContext";
import apiClient from "../../../api/client";
import {
  FiCalendar,
  FiClock,
  FiMapPin,
  FiUsers,
  FiEdit,
  FiEye,
  FiPlus,
  FiCheckCircle,
  FiXCircle,
  FiClock as FiClockIcon,
  FiGlobe,
  FiLink,
  FiChevronLeft,
  FiChevronRight,
  FiAlertTriangle,
  FiCopy,
  FiArchive,
} from "react-icons/fi";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import styles from "./Events.module.css";
import {
  getEventStatus,
  EVENT_STATUS_CONFIG,
  EVENT_STATUS_SORT_ORDER,
  isMissedInvitation,
} from "../../../utils/eventStatus";

import EventCardView from "../../../components/events/EventCardView";
import EventInvitation from "../../../components/events/EventInvitation";
import AttendeesModal from "../../../components/events/AttendeesModal";
import ConflictCardEvent from "../../../components/events/ConflictCardEvent";
import FeedbackModal from "../../../components/common/FeedbackModal";

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (timeStr) => {
  if (!timeStr) return "";
  if (
    typeof timeStr === "string" &&
    timeStr.includes(":") &&
    !timeStr.includes("T")
  ) {
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0]);
    const mins = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${mins} ${ampm}`;
  }
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return timeStr;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || "?";
};

const AVATAR_COLORS = [
  "#f9a825",
  "#43a047",
  "#1e88e5",
  "#8e24aa",
  "#fb8c00",
  "#00897b",
  "#5e35b1",
];
const getAvatarColor = (str) => {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function Events() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { searchTerm, duration, eventType } = useEventsFilter();

  const [activeTab, setActiveTab] = useState("all");
  const [invitedSubTab, setInvitedSubTab] = useState("pending");

  const [createdEvents, setCreatedEvents] = useState([]);
  const [invitedEvents, setInvitedEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [collaborationEvents, setCollaborationEvents] = useState([]);
  const [archivedEvents, setArchivedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");

  // ── All tab local filters ──
  const [allStatusFilter, setAllStatusFilter] = useState("all");
  const [allMethodFilter, setAllMethodFilter] = useState("all");

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [invitationMode, setInvitationMode] = useState("invite"); // invite | revert
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);

  const [conflictEvent, setConflictEvent] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const [copiedLinkId, setCopiedLinkId] = useState(null);

  const [feedback, setFeedback] = useState({ message: "", type: "success" });
  const showFeedback = (msg, type = "success") =>
    setFeedback({ message: msg, type });

  const [todayEvents, setTodayEvents] = useState([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [currentTodayIndex, setCurrentTodayIndex] = useState(0);
  const [todayTouchStartX, setTodayTouchStartX] = useState(0);

  const fetchTodayEvents = useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await apiClient.get("/events/today");
      if (res.data.ok) {
        setTodayEvents(res.data.events || []);
        setCurrentTodayIndex(0);
      } else setTodayEvents([]);
    } catch (err) {
      console.error("Failed to fetch today's events:", err);
      setTodayEvents([]);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
        .toISOString()
        .slice(0, 10);
      const eventsRes = await apiClient.get(
        `/events?start=${start}&end=${end}`,
      );
      const allEventsData = eventsRes.data.events || [];

      const currentUserId = user?.id;
      const created = allEventsData.filter(
        (ev) => ev.creatorId === currentUserId,
      );
      const invited = allEventsData.filter(
        (ev) => ev.creatorId !== currentUserId,
      );

      const createdWithResponse = created.map((ev) => ({
        ...ev,
        response: ev.userResponse || "accepted",
        isCreator: true,
      }));
      const invitedWithResponse = invited.map((ev) => ({
        ...ev,
        response: ev.userResponse || "accepted",
        isCreator: false,
      }));

      setCreatedEvents(createdWithResponse);
      setInvitedEvents(invitedWithResponse);
      setAllEvents([...createdWithResponse, ...invitedWithResponse]);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError(err.response?.data?.message || err.message || "We could not load events. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchCollaborationEvents = useCallback(async () => {
    try {
      const res = await apiClient.get("/events/collaborations");
      if (res.data.ok) setCollaborationEvents(res.data.events || []);
      else setCollaborationEvents([]);
    } catch (err) {
      console.error("Failed to fetch collaboration events:", err);
      setCollaborationEvents([]);
    }
  }, []);

  const fetchArchivedEvents = useCallback(async () => {
    try {
      const res = await apiClient.get("/events/archived");
      if (!res.data.ok) throw new Error(res.data.message || "The server did not return archived event records.");
      setArchivedEvents(res.data.events || []);
      setArchiveError("");
    } catch (err) {
      console.error("Failed to fetch archived events:", err);
      setArchiveError(err.response?.data?.message || err.message || "We could not load archived events. Check your connection and try again.");
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  const refreshEventViews = () => {
    fetchEvents();
    fetchTodayEvents();
    fetchCollaborationEvents();
    fetchArchivedEvents();
  };

  useEffect(() => {
    const loadEventViews = async () => {
      await Promise.all([
        fetchTodayEvents(),
        fetchEvents(),
        fetchCollaborationEvents(),
        fetchArchivedEvents(),
      ]);
    };
    loadEventViews();
  }, [fetchTodayEvents, fetchEvents, fetchCollaborationEvents, fetchArchivedEvents]);

  const filterEvents = useCallback(
    (events) => {
      let filtered = events;
      if (searchTerm.trim()) {
        const lower = searchTerm.toLowerCase();
        filtered = filtered.filter((ev) =>
          ev.title.toLowerCase().includes(lower),
        );
      }
      if (eventType !== "all")
        filtered = filtered.filter((ev) => ev.type === eventType);
      if (duration !== "all") {
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        let startDate, endDate;
        if (duration === "day") {
          startDate = today;
          endDate = new Date(today);
          endDate.setDate(endDate.getDate() + 1);
        } else if (duration === "week") {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          startDate = startOfWeek;
          endDate = new Date(startOfWeek);
          endDate.setDate(endDate.getDate() + 7);
        } else if (duration === "month") {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }
        filtered = filtered.filter((ev) => {
          const evDate = new Date(ev.date || ev.start_datetime);
          return evDate >= startDate && evDate < endDate;
        });
      }
      return filtered;
    },
    [searchTerm, eventType, duration],
  );

  const handleViewEvent = async (event) => {
    try {
      const res = await apiClient.get(`/events/${event.id}`);
      if (res.data.ok) setSelectedEvent(res.data.event);
      else setSelectedEvent(event);
    } catch (err) {
      console.error("Failed to fetch event details:", err);
      setSelectedEvent(event);
    } finally {
      setShowViewModal(true);
    }
  };

  const handleViewInvitation = async (event, mode = "invite") => {
    try {
      const res = await apiClient.get(`/events/${event.id}`);
      if (res.data.ok) setSelectedEvent(res.data.event);
      else setSelectedEvent(event);
    } catch (err) {
      console.error("Failed to fetch invitation details:", err);
      setSelectedEvent(event);
    } finally {
      setInvitationMode(mode);
      setShowInvitationModal(true);
    }
  };

  const handleViewAttendees = async (event) => {
    if (event.participants && event.participants.users) {
      setSelectedEvent(event);
      setShowAttendeesModal(true);
      return;
    }
    try {
      const res = await apiClient.get(`/events/${event.id}`);
      if (res.data.ok) setSelectedEvent(res.data.event);
      else setSelectedEvent(event);
    } catch (err) {
      console.error("Failed to fetch event details:", err);
      setSelectedEvent(event);
    } finally {
      setShowAttendeesModal(true);
    }
  };

  const handleShowConflict = (event) => {
    setConflictEvent(event);
    setShowConflictModal(true);
  };

  const handleCopyLink = (id, link) => {
    if (!link) return;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopiedLinkId(id);
        setTimeout(() => setCopiedLinkId(null), 1500);
      })
      .catch(() => {});
  };

  const handleEditEvent = (eventId) => navigate(`/edit-event/${eventId}`);

  const handleRespond = async (eventId, response) => {
    try {
      await apiClient.put(`/notifications/${eventId}/respond`, { response });
      fetchEvents();
      setShowInvitationModal(false);
      showFeedback(
        response === "accepted"
          ? "Invitation accepted!"
          : "Invitation declined.",
        "success",
      );
    } catch (err) {
      console.error("Failed to respond:", err);
      showFeedback(err.response?.data?.message || err.message || "We could not update your invitation response. Please try again.", "error");
    }
  };

  const handleTodayPrev = () =>
    setCurrentTodayIndex((prev) =>
      prev === 0 ? todayEvents.length - 1 : prev - 1,
    );
  const handleTodayNext = () =>
    setCurrentTodayIndex((prev) =>
      prev === todayEvents.length - 1 ? 0 : prev + 1,
    );
  const handleTodayTouchStart = (e) =>
    setTodayTouchStartX(e.touches[0].clientX);
  const handleTodayTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = todayTouchStartX - endX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleTodayNext();
      else handleTodayPrev();
    }
  };

  const isTodayEventAccepted = (todayEvent) => {
    const myEntry = (todayEvent.participants?.users || []).find(
      (u) => u.id === user?.id,
    );
    return myEntry ? myEntry.response === "accepted" : true;
  };

  const renderTodayEventCard = (todayEvent) => {
    if (!todayEvent) return null;

    const creator = todayEvent.creator || {};
    const creatorName = creator.full_name || creator.username || "Unknown";
    const creatorPosition = creator.position || "";
    const creatorAffiliation = [creator.department, creator.office]
      .filter(Boolean)
      .join(" | ");
    const creatorSub = [creatorPosition, creatorAffiliation]
      .filter(Boolean)
      .join(" | ");

    const participants = todayEvent.participants || {};
    const depts = participants.departments || [];
    const offices = participants.offices || [];
    const allUsers = participants.users || [];
    const acceptedUsers = allUsers.filter((u) => u.response === "accepted");

    const status = getEventStatus(todayEvent);
    const statusCfg = EVENT_STATUS_CONFIG[status];
    const conflict = todayEvent.conflict || {};
    const accepted = isTodayEventAccepted(todayEvent);

    return (
      <div className={styles.featuredEventSection}>
        <div className={styles.featuredContainer}>
          <div className={styles.featuredCard}>
            <div className={styles.badgesStatus}>
              <div className={styles.badgeRow}>
                <div className={styles.badgePill}>
                  {todayEvent.hierarchy || "Unknown Hierarchy"}
                </div>
                <div className={styles.badgePill}>
                  {todayEvent.method || "Unknown Method"}
                </div>
                <div className={styles.badgePill}>
                  {todayEvent.visibility || "Unknown Visibility"}
                </div>
                <div className={styles.badgePill}>
                  {todayEvent.event_type || "Unknown Type"}
                </div>
                <div
                  className={`${styles.statusBadgeSmall} ${styles[statusCfg.className]}`}
                >
                  {statusCfg.label}
                </div>
              </div>
              <div className={styles.heading2}>
                <div className={styles.featuredTitle}>{todayEvent.title}</div>
              </div>
            </div>

            <div className={styles.featuredCardContent}>
              <div className={styles.titleDescription}>
                <div className={styles.descriptionText}>
                  {todayEvent.description}
                </div>
              </div>

              <div className={styles.container8}>
                <div className={styles.whenWhereGroup}>
                  <div className={styles.sectionHeader}>
                    <EventNoteOutlinedIcon fontSize="small" />
                    <div className={styles.heading4}>
                      <div className={styles.text7}>WHEN &amp; WHERE</div>
                    </div>
                  </div>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoBlock}>
                      <div className={styles.infoLabel}>DATE RANGE</div>
                      <div className={styles.infoValue}>
                        {formatDate(todayEvent.start_datetime)} —{" "}
                        {formatDate(todayEvent.end_datetime)}
                      </div>
                    </div>
                    <div className={styles.infoBlock}>
                      <div className={styles.infoLabel}>TIME</div>
                      <div className={styles.infoValue}>
                        {formatTime(todayEvent.start_datetime)} —{" "}
                        {formatTime(todayEvent.end_datetime)}
                      </div>
                    </div>
                    <div className={styles.infoBlock}>
                      <div className={styles.infoLabel}>LOCATION</div>
                      <div className={styles.infoValue}>
                        {todayEvent.venue || todayEvent.location || "Online"}
                      </div>
                    </div>
                  </div>
                  {todayEvent.method === "online" &&
                    todayEvent.link &&
                    accepted && (
                      <div className={styles.linkSection}>
                        <FiLink size={14} />
                        <span className={styles.linkText}>
                          {todayEvent.link}
                        </span>
                        <button
                          type="button"
                          className={styles.copyLinkBtn}
                          onClick={() =>
                            handleCopyLink(todayEvent.id, todayEvent.link)
                          }
                        >
                          <FiCopy size={12} />
                          {copiedLinkId === todayEvent.id ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    )}
                </div>

                <div className={styles.organizerSection}>
                  <div className={styles.sectionHeader}>
                    <PersonOutlinedIcon fontSize="small" />
                    <div className={styles.heading4}>
                      <div className={styles.text7}>ORGANIZER</div>
                    </div>
                  </div>
                  <div className={styles.organizerRow}>
                    <div className={styles.organizerAvatar}>
                      {getInitials(creatorName)}
                    </div>
                    <div className={styles.organizerDetails}>
                      <div className={styles.organizerName}>{creatorName}</div>
                      <div className={styles.organizerTitle}>
                        {creatorSub || "Organizer"}
                      </div>
                    </div>
                  </div>
                  <div className={styles.participatingBlock}>
                    <div className={styles.infoLabel}>
                      PARTICIPATING DEPARTMENTS
                    </div>
                    <div className={styles.deptBadges}>
                      {depts.length > 0 ? (
                        depts.slice(0, 4).map((dept) => (
                          <div key={dept} className={styles.deptBadge}>
                            {dept}
                          </div>
                        ))
                      ) : (
                        <span className={styles.noDataText}>
                          No departments
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.participatingBlock}>
                    <div className={styles.infoLabel}>
                      PARTICIPATING OFFICES
                    </div>
                    <div className={styles.deptBadges}>
                      {offices.length > 0 ? (
                        offices.slice(0, 4).map((office) => (
                          <div key={office} className={styles.deptBadge}>
                            {office}
                          </div>
                        ))
                      ) : (
                        <span className={styles.noDataText}>No offices</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.audienceSection}>
                  <div className={styles.sectionHeader}>
                    <GroupsOutlinedIcon fontSize="small" />
                    <div className={styles.heading4}>
                      <div className={styles.text7}>AUDIENCE</div>
                    </div>
                  </div>
                  <div className={styles.audienceRow}>
                    <div className={styles.attendeeStack}>
                      {acceptedUsers.slice(0, 4).map((u) => {
                        const name =
                          u.full_name || u.username || u.email || "Unknown";
                        return (
                          <div
                            key={u.id}
                            className={styles.attendeeAvatar}
                            style={{ background: getAvatarColor(name) }}
                          >
                            {getInitials(name)}
                          </div>
                        );
                      })}
                      {acceptedUsers.length >= 5 && (
                        <div className={styles.attendeeMore}>
                          +{acceptedUsers.length - 4}
                        </div>
                      )}
                    </div>
                    <div className={styles.audienceText}>
                      {acceptedUsers.length > 0
                        ? `${acceptedUsers[0].full_name || acceptedUsers[0].username || acceptedUsers[0].email} and ${acceptedUsers.length - 1} others attending`
                        : "No attendees yet"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.viewAttendeesButton}
                    onClick={() => handleViewAttendees(todayEvent)}
                  >
                    <VisibilityOutlinedIcon fontSize="small" />
                    View Attendees
                  </button>
                </div>
              </div>

              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.viewEventButton}
                  onClick={() => handleViewEvent(todayEvent)}
                >
                  View Event Details
                </button>
              </div>

              {conflict.isConflicted && (
                <button
                  type="button"
                  className={`${styles.conflictBtn} ${conflict.isPriority ? styles.conflictBtnPriority : styles.conflictBtnWarning}`}
                  onClick={() => handleShowConflict(todayEvent)}
                >
                  <FiAlertTriangle size={13} />
                  {conflict.isPriority ? "Priority Event" : "Conflicted"} — View
                  details
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTodayEventsCarousel = () => {
    if (todayLoading)
      return (
        <div className={styles.emptyStateBox}>
          <FiClock size={28} className={styles.emptyStateIcon} />
          <p className={styles.emptyStateText}>Loading today's event...</p>
        </div>
      );
    if (todayEvents.length === 0)
      return (
        <div className={styles.emptyStateBox}>
          <FiCalendar size={28} className={styles.emptyStateIcon} />
          <p className={styles.emptyStateText}>No events today</p>
          <p className={styles.emptyStateSubtext}>
            Enjoy the free time — nothing on your schedule for today.
          </p>
        </div>
      );

    return (
      <div
        className={styles.carouselWrapper}
        onTouchStart={handleTodayTouchStart}
        onTouchEnd={handleTodayTouchEnd}
      >
        <div
          className={styles.carouselTrack}
          style={{ transform: `translateX(-${currentTodayIndex * 100}%)` }}
        >
          {todayEvents.map((ev) => (
            <div key={ev.id} className={styles.carouselSlide}>
              {renderTodayEventCard(ev)}
            </div>
          ))}
        </div>
        {todayEvents.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
              onClick={handleTodayPrev}
            >
              <FiChevronLeft size={20} />
            </button>
            <button
              type="button"
              className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
              onClick={handleTodayNext}
            >
              <FiChevronRight size={20} />
            </button>
            <div className={styles.dotsContainer}>
              {todayEvents.map((_, idx) => (
                <span
                  key={idx}
                  className={`${styles.dot} ${idx === currentTodayIndex ? styles.dotActive : ""}`}
                  onClick={() => setCurrentTodayIndex(idx)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderEventCard = (event, variant = "all") => {
    let locationDisplay = "";
    if (event.method === "online") locationDisplay = "Online";
    else locationDisplay = event.venue || event.location || "";

    const handleCardClick = () => {
      if (event.response === "pending") {
        handleViewInvitation(event, "invite");
      } else if (event.response === "declined") {
        handleViewInvitation(event, "revert");
      } else {
        handleViewEvent(event);
      }
    };

    const showEditIcon = variant === "created" || variant === "collaboration";
    const status = getEventStatus(event);
    const statusCfg = EVENT_STATUS_CONFIG[status];
    const conflict = event.conflict || {};
    const missed = isMissedInvitation(event);

    return (
      <div
        key={event.id}
        className={styles.eventCard}
        style={{ borderLeftColor: event.color || "#800000" }}
        onClick={handleCardClick}
      >
        {showEditIcon && (
          <button
            type="button"
            className={styles.editIconBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleEditEvent(event.id);
            }}
            title="Edit event"
          >
            <FiEdit size={14} />
          </button>
        )}

        <div className={styles.cardTitleLarge}>{event.title}</div>
        {event.description && (
          <div className={styles.cardDescription}>{event.description}</div>
        )}

        <div className={styles.cardSeparator} />

        <div className={styles.cardMetaRow}>
          <span className={styles.metaBadge}>{event.hierarchy || "Local"}</span>
          <span className={styles.metaBadge}>
            {event.event_type || "Event"}
          </span>
          <span
            className={`${styles.statusBadgeSmall} ${styles[statusCfg.className]}`}
          >
            {statusCfg.label}
          </span>
          {missed && (
            <span className={styles.missedBadge}>Missed Invitation</span>
          )}
        </div>

        <div className={styles.cardSeparator} />

        <div className={styles.cardDetails}>
          <span>
            <FiCalendar size={14} />{" "}
            {formatDate(event.start_datetime || event.date)}
          </span>
          <span>
            <FiClock size={14} />{" "}
            {formatTime(event.start_datetime || event.time)} -{" "}
            {formatTime(event.end_datetime || event.endTime)}
          </span>
          <span>
            <FiMapPin size={14} /> {locationDisplay}
          </span>
        </div>

        {event.method === "online" &&
          event.link &&
          event.response === "accepted" && (
            <div
              className={styles.linkSection}
              onClick={(e) => e.stopPropagation()}
            >
              <FiLink size={14} />
              <span className={styles.linkText}>{event.link}</span>
              <button
                type="button"
                className={styles.copyLinkBtn}
                onClick={() => handleCopyLink(event.id, event.link)}
              >
                <FiCopy size={12} />
                {copiedLinkId === event.id ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

        <div className={styles.cardSeparator} />

        {event.creator && (
          <div className={styles.creatorBlock}>
            <div
              className={styles.creatorAvatar}
              style={{
                background: getAvatarColor(
                  event.creator.full_name || event.creator.email,
                ),
              }}
            >
              {getInitials(event.creator.full_name || event.creator.email)}
            </div>
            <div className={styles.creatorInfo}>
              <span className={styles.creatorName}>
                {event.creator.full_name}
              </span>
              <span className={styles.creatorEmail}>{event.creator.email}</span>
              {[
                event.creator.department,
                event.creator.office,
                event.creator.position,
              ].filter(Boolean).length > 0 && (
                <span className={styles.creatorAffiliation}>
                  {[
                    event.creator.department,
                    event.creator.office,
                    event.creator.position,
                  ]
                    .filter(Boolean)
                    .join(" | ")}
                </span>
              )}
            </div>
          </div>
        )}

        <div className={styles.cardSeparator} />

        <div className={styles.cardBadges}>
          {getVisibilityBadge(event.type || event.visibility)}
          <span className={styles.methodBadge}>
            {event.method === "online" ? (
              <FiLink size={12} />
            ) : (
              <FiGlobe size={12} />
            )}
            {getMethodLabel(event.method)}
          </span>
          {event.response && getStatusBadge(event.response)}
        </div>

        {conflict.isConflicted && (
          <button
            type="button"
            className={`${styles.conflictBtn} ${conflict.isPriority ? styles.conflictBtnPriority : styles.conflictBtnWarning}`}
            onClick={(e) => {
              e.stopPropagation();
              handleShowConflict(event);
            }}
          >
            <FiAlertTriangle size={13} />
            {conflict.isPriority ? "Priority Event" : "Conflicted"} — View
            details
          </button>
        )}
      </div>
    );
  };

  const getVisibilityBadge = (type) => {
    const map = {
      campus: { class: styles.badgeCampus, label: "Campus" },
      department: { class: styles.badgeDepartment, label: "Department" },
      private: { class: styles.badgePrivate, label: "Private" },
    };
    const s = map[type] || map.private;
    return <span className={s.class}>{s.label}</span>;
  };

  const getStatusBadge = (status) => {
    const map = {
      accepted: {
        class: styles.badgeAccepted,
        icon: FiCheckCircle,
        label: "Accepted",
      },
      declined: {
        class: styles.badgeDeclined,
        icon: FiXCircle,
        label: "Declined",
      },
      pending: {
        class: styles.badgePending,
        icon: FiClockIcon,
        label: "Pending",
      },
    };
    const s = map[status] || map.pending;
    return (
      <span className={s.class}>
        <s.icon size={12} /> {s.label}
      </span>
    );
  };

  const getMethodLabel = (method) =>
    method === "online" ? "Online" : "Face-to-face";

  const sortByDefaultOrder = (events) => {
    return [...events].sort((a, b) => {
      const rankA = EVENT_STATUS_SORT_ORDER[getEventStatus(a)];
      const rankB = EVENT_STATUS_SORT_ORDER[getEventStatus(b)];
      if (rankA !== rankB) return rankA - rankB;
      return (
        new Date(a.start_datetime || a.date) -
        new Date(b.start_datetime || b.date)
      );
    });
  };

  const renderContent = () => {
    if (activeTab === "archived") {
      if (archiveLoading) return <p className={styles.loading}>Loading archived events...</p>;
      if (archiveError) {
        return (
          <div className={styles.error}>
            <p>{archiveError}</p>
            <button
              type="button"
              className={styles.createBtn}
              onClick={() => {
                setArchiveLoading(true);
                setArchiveError("");
                fetchArchivedEvents();
              }}
            >
              Try again
            </button>
          </div>
        );
      }
      return archivedEvents.length === 0 ? (
        <div className={styles.emptyStateBox}><FiArchive size={28} /><p>No archived events.</p></div>
      ) : (
        <div className={styles.archiveList}>
          {archivedEvents.map((event) => (
            <article
              className={styles.archiveCard}
              key={event.id}
              style={{ borderLeftColor: event.color || "#800000" }}
            >
              <div>
                <h3>{event.title}</h3>
                <p>{event.description || "No description"}</p>
                <span>
                  {event.method === "online"
                    ? "Online"
                    : event.venue || event.location || "Location undecided"}
                </span>
              </div>
              <button
                type="button"
                className={styles.createBtn}
                onClick={() => navigate("/create-event", { state: { template: event } })}
              >
                Use as template
              </button>
            </article>
          ))}
        </div>
      );
    }

    if (loading) return <p className={styles.loading}>Loading events...</p>;
    if (error) return <p className={styles.error}>{error}</p>;

    switch (activeTab) {
      case "all": {
        let filteredAll = filterEvents(allEvents);
        if (allStatusFilter !== "all")
          filteredAll = filteredAll.filter(
            (ev) => getEventStatus(ev) === allStatusFilter,
          );
        if (allMethodFilter !== "all")
          filteredAll = filteredAll.filter(
            (ev) => ev.method === allMethodFilter,
          );
        filteredAll = sortByDefaultOrder(filteredAll);

        return (
          <>
            <div className={styles.todaySection}>
              <div className={styles.todayHeader}>
                <h2>Today's Event</h2>
                <span className={styles.todayDate}>
                  {formatDate(new Date())}
                </span>
              </div>
              <div className={styles.todayContent}>
                {renderTodayEventsCarousel()}
              </div>
            </div>

            <div className={styles.subFilterRow}>
              <select
                className={styles.subFilterSelect}
                value={allStatusFilter}
                onChange={(e) => setAllStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="ongoing">Ongoing</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
              <select
                className={styles.subFilterSelect}
                value={allMethodFilter}
                onChange={(e) => setAllMethodFilter(e.target.value)}
              >
                <option value="all">All Methods</option>
                <option value="online">Online</option>
                <option value="face-to-face">Face-to-face</option>
              </select>
            </div>

            <div className={styles.eventList}>
              {filteredAll.length === 0 ? (
                <div className={styles.emptyStateBox}>
                  <FiCalendar size={28} className={styles.emptyStateIcon} />
                  <p className={styles.emptyStateText}>No events found</p>
                </div>
              ) : (
                filteredAll.map((ev) => renderEventCard(ev, "all"))
              )}
            </div>
          </>
        );
      }

      case "invited": {
        let invitedFiltered = filterEvents(invitedEvents);
        if (invitedSubTab === "pending")
          invitedFiltered = invitedFiltered.filter(
            (ev) => ev.response === "pending" && !isMissedInvitation(ev),
          );
        else if (invitedSubTab === "declined")
          invitedFiltered = invitedFiltered.filter(
            (ev) => ev.response === "declined",
          );
        else if (invitedSubTab === "missed")
          invitedFiltered = invitedFiltered.filter((ev) =>
            isMissedInvitation(ev),
          );

        return (
          <div className={styles.invitedContainer}>
            <div className={styles.invitedTabs}>
              <button
                className={`${styles.invitedTab} ${invitedSubTab === "pending" ? styles.activeInvitedTab : ""}`}
                onClick={() => setInvitedSubTab("pending")}
              >
                Pending (
                {
                  invitedEvents.filter(
                    (ev) =>
                      ev.response === "pending" && !isMissedInvitation(ev),
                  ).length
                }
                )
              </button>
              <button
                className={`${styles.invitedTab} ${invitedSubTab === "all" ? styles.activeInvitedTab : ""}`}
                onClick={() => setInvitedSubTab("all")}
              >
                All ({invitedEvents.length})
              </button>
              <button
                className={`${styles.invitedTab} ${invitedSubTab === "declined" ? styles.activeInvitedTab : ""}`}
                onClick={() => setInvitedSubTab("declined")}
              >
                Declined (
                {
                  invitedEvents.filter((ev) => ev.response === "declined")
                    .length
                }
                )
              </button>
              <button
                className={`${styles.invitedTab} ${invitedSubTab === "missed" ? styles.activeInvitedTab : ""}`}
                onClick={() => setInvitedSubTab("missed")}
              >
                Missed (
                {invitedEvents.filter((ev) => isMissedInvitation(ev)).length})
              </button>
            </div>
            <div className={styles.eventList}>
              {invitedFiltered.length === 0 ? (
                <div className={styles.emptyStateBox}>
                  <FiCalendar size={28} className={styles.emptyStateIcon} />
                  <p className={styles.emptyStateText}>
                    No {invitedSubTab} invitations
                  </p>
                </div>
              ) : (
                invitedFiltered.map((ev) => renderEventCard(ev, "invited"))
              )}
            </div>
          </div>
        );
      }

      case "created": {
        const filteredCreated = filterEvents(createdEvents);
        return (
          <div className={styles.eventList}>
            {filteredCreated.length === 0 ? (
              <div className={styles.emptyStateBox}>
                <FiPlus size={28} className={styles.emptyStateIcon} />
                <p className={styles.emptyStateText}>
                  You haven't created any events yet
                </p>
                <button
                  className={styles.createBtn}
                  onClick={() => navigate("/create-event")}
                >
                  Create Event
                </button>
              </div>
            ) : (
              filteredCreated.map((ev) => renderEventCard(ev, "created"))
            )}
          </div>
        );
      }

      case "collaboration": {
        const filteredCollaboration = filterEvents(collaborationEvents);
        return (
          <div className={styles.eventList}>
            {filteredCollaboration.length === 0 ? (
              <div className={styles.emptyStateBox}>
                <FiUsers size={28} className={styles.emptyStateIcon} />
                <p className={styles.emptyStateText}>
                  You are not a collaborator on any events
                </p>
              </div>
            ) : (
              filteredCollaboration.map((ev) =>
                renderEventCard(ev, "collaboration"),
              )
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "all" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("all")}
        >
          <FiEye size={16} /> All Events
        </button>
        <button
          className={`${styles.tab} ${activeTab === "invited" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("invited")}
        >
          <FiCalendar size={16} /> Invited
        </button>
        <button
          className={`${styles.tab} ${activeTab === "created" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("created")}
        >
          <FiEdit size={16} /> Created
        </button>
        <button
          className={`${styles.tab} ${activeTab === "collaboration" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("collaboration")}
        >
          <FiUsers size={16} /> Collaboration
        </button>
        <button
          className={`${styles.tab} ${activeTab === "archived" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("archived")}
        >
          <FiArchive size={16} /> Archived
        </button>
      </div>

      <div className={styles.content}>{renderContent()}</div>

      <EventCardView
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        onActionSuccess={refreshEventViews}
      />

      <EventInvitation
        isOpen={showInvitationModal}
        onClose={() => {
          setShowInvitationModal(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        onRespond={handleRespond}
        mode={invitationMode}
      />

      <AttendeesModal
        isOpen={showAttendeesModal}
        onClose={() => {
          setShowAttendeesModal(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
      />

      <ConflictCardEvent
        isOpen={showConflictModal}
        onClose={() => {
          setShowConflictModal(false);
          setConflictEvent(null);
        }}
        event={conflictEvent}
      />

      <FeedbackModal
        message={feedback.message}
        type={feedback.type}
        onClose={() => setFeedback({ message: "", type: "success" })}
      />
    </div>
  );
}
