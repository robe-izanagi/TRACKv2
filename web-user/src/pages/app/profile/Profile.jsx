import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../api/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FiUser,
  FiMapPin,
  FiBriefcase,
  FiEdit,
  FiLogOut,
  FiLink,
  FiChevronRight,
  FiCamera,
  FiX,
  FiBarChart2,
  FiTrendingUp,
  FiPieChart,
  FiCheckSquare,
  FiAlertTriangle,
  FiActivity,
  FiInfo,
} from "react-icons/fi";
import {
  getCampusOfficeStats,
  getDepartmentOfficePerformance,
  getConflictForecast,
  getVenuePie,
  getSchedulingConflicts,
  getPersonalEvents,
  getTaskStats,
} from "../../../api/analytics";
import FeedbackModal from "../../../components/common/FeedbackModal";
import styles from "./Profile.module.css";

const PIE_COLORS = [
  "#7c2d12",
  "#4c1d95",
  "#2563eb",
  "#06b6d4",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#84cc16",
  "#8b5cf6",
  "#ef4444",
];

const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 Days" },
  { value: 30, label: "Last 30 Days" },
  { value: 90, label: "Last 90 Days" },
];

const FORECAST_DAY_OPTIONS = [
  { value: 7, label: "7 Days" },
  { value: 14, label: "14 Days" },
  { value: 30, label: "30 Days" },
];

const PERF_VISIBLE_COUNT = 5;

// ── Input limits ──
// Names: letters (incl. common accented Latin letters) and spaces only —
// no numbers, symbols, or emoji.
const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 500;
const NAME_DISALLOWED_CHARS = /[^a-zA-Z\u00C0-\u024F\s]/g;

const sanitizeName = (value) =>
  value.replace(NAME_DISALLOWED_CHARS, "").slice(0, MAX_NAME_LENGTH);

// ── Merge a full lookup list (all departments/offices) with performance
// counts, defaulting to 0 for anything with no recorded activity — so
// zero-performing departments/offices still show up instead of being
// silently dropped. ──
const mergeWithZeroPerf = (lookupList, perfList) => {
  const perfMap = new Map((perfList || []).map((p) => [String(p.id), p.count]));
  return (lookupList || [])
    .map((item) => ({
      id: item.id,
      name: item.name,
      count: perfMap.get(String(item.id)) || 0,
    }))
    .sort((a, b) => b.count - a.count);
};

// ── Skeleton building blocks (shimmer placeholders, not the word "Loading") ──
const SkeletonBar = ({ w = "100%", h = 14, r = 6, style }) => (
  <div
    className={styles.skeleton}
    style={{ width: w, height: h, borderRadius: r, ...style }}
  />
);

const KpiSkeleton = () => (
  <div className={styles.kpiCard}>
    <SkeletonBar w={130} h={11} />
    <SkeletonBar w={170} h={22} style={{ marginTop: 8 }} />
    <div className={styles.kpiGrid} style={{ marginTop: 6 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={styles.kpiStatBlock}>
          <SkeletonBar w={50} h={9} />
          <SkeletonBar w={40} h={20} style={{ marginTop: 4 }} />
        </div>
      ))}
    </div>
    <SkeletonBar h={140} r={14} style={{ marginTop: 4 }} />
  </div>
);

const CardSkeleton = ({ chartHeight = 180 }) => (
  <div className={styles.analyticsCard}>
    <div className={styles.cardHeaderRow}>
      <SkeletonBar w={16} h={16} r={4} />
      <SkeletonBar w={150} h={13} />
    </div>
    <SkeletonBar h={chartHeight} r={12} />
  </div>
);

const ListRowSkeleton = () => (
  <div className={styles.perfRow}>
    <div className={styles.perfRowTop}>
      <SkeletonBar w="45%" h={12} />
      <SkeletonBar w={24} h={12} />
    </div>
    <SkeletonBar h={8} r={8} />
  </div>
);

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [changeProfileRequestOpen, setChangeProfileRequestOpen] =
    useState(false);

  const [requestChanges, setRequestChanges] = useState({
    department_change: false,
    office_change: false,
    role_update: false,
    position_update: false,
  });
  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedOffice, setSelectedOffice] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [removeDepartment, setRemoveDepartment] = useState(false);
  const [removeOffice, setRemoveOffice] = useState(false);
  const [requestDetails, setRequestDetails] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");

  const [editName, setEditName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editMessage, setEditMessage] = useState("");

  const fileInputRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [feedback, setFeedback] = useState({ message: "", type: "success" });
  const showFeedback = (msg, type = "success") =>
    setFeedback({ message: msg, type });

  // ══════════════════════════════════════════════════════
  // ── Analytics state ──
  // ══════════════════════════════════════════════════════
  const [range, setRange] = useState(30);

  const [campusOfficeData, setCampusOfficeData] = useState(null);
  const [campusOfficeLoading, setCampusOfficeLoading] = useState(true);

  const [venues, setVenues] = useState([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [forecastDays, setForecastDays] = useState(7);
  const [conflictForecast, setConflictForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const [venuePie, setVenuePie] = useState(null);
  const [venuePieLoading, setVenuePieLoading] = useState(true);

  const [taskStats, setTaskStats] = useState(null);
  const [taskStatsLoading, setTaskStatsLoading] = useState(true);
  const [deptPerf, setDeptPerf] = useState(null);
  const [deptPerfLoading, setDeptPerfLoading] = useState(true);
  const [perfTab, setPerfTab] = useState("departments");
  const [perfShowAll, setPerfShowAll] = useState(false);

  const [schedulingConflicts, setSchedulingConflicts] = useState(null);
  const [schedulingLoading, setSchedulingLoading] = useState(true);

  const [personalEvents, setPersonalEvents] = useState(null);
  const [personalLoading, setPersonalLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get("/auth/me");
        if (data.ok) {
          setProfile(data.user);
          setEditName(data.user.full_name || "");
        } else {
          setError("Failed to load profile.");
        }
      } catch (err) {
        setError("Unable to load profile. Please try again later.");
        console.error("Profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchLookups = async () => {
      try {
        const deptRes = await apiClient.get("/lookups/departments");
        if (deptRes.data.ok && deptRes.data.items)
          setDepartments(deptRes.data.items);

        const offRes = await apiClient.get("/lookups/offices");
        if (offRes.data.ok && offRes.data.items) setOffices(offRes.data.items);

        const roleRes = await apiClient.get("/lookups/roles");
        if (roleRes.data.ok && roleRes.data.items) setRoles(roleRes.data.items);

        const posRes = await apiClient.get("/lookups/available-positions");
        if (posRes.data.ok && posRes.data.positions)
          setPositions(posRes.data.positions);
      } catch (err) {
        console.error("Lookup fetch error:", err);
      }
    };

    fetchProfile();
    fetchLookups();
  }, []);

  // ── Edit Profile ───
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    setEditMessage("");
    try {
      const { data } = await apiClient.put("/auth/profile", {
        full_name: editName,
      });
      if (data.ok) {
        setProfile((prev) => ({ ...prev, full_name: editName }));
        setEditModalOpen(false);
        showFeedback("Profile updated successfully!", "success");
      } else {
        setEditMessage(data.message || "Update failed.");
        showFeedback(data.message || "Update failed.", "error");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Server error.";
      setEditMessage(msg);
      showFeedback(msg, "error");
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Upload Profile Picture ───
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showFeedback("Image must be less than 5MB.", "error");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showFeedback("Only JPG, PNG, and WEBP images are allowed.", "error");
      return;
    }
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        const { data } = await apiClient.put("/auth/profile-picture", {
          picture_url: base64,
        });
        if (data.ok) {
          setProfile((prev) => ({ ...prev, display_picture: base64 }));
          showFeedback("Profile picture updated!", "success");
        } else {
          showFeedback("Failed to update profile picture.", "error");
        }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload error:", err);
      showFeedback("Error uploading image.", "error");
      setUploadingPhoto(false);
    }
    e.target.value = "";
  };

  // ── Change Profile Request ───
  const handleChangeCheckbox = (key) => {
    setRequestChanges((prev) => ({ ...prev, [key]: !prev[key] }));
    if (!requestChanges[key]) {
      if (key === "department_change") {
        setSelectedDepartment("");
        setRemoveDepartment(false);
      }
      if (key === "office_change") {
        setSelectedOffice("");
        setRemoveOffice(false);
      }
      if (key === "role_update") setSelectedRole("");
      if (key === "position_update") setSelectedPosition("");
    }
  };

  const handleChangeProfileSubmit = async (e) => {
    e.preventDefault();
    setRequestSubmitting(true);
    setRequestMessage("");

    const selectedChanges = Object.keys(requestChanges).filter(
      (key) => requestChanges[key],
    );
    if (selectedChanges.length === 0) {
      const msg = "Please select at least one change type.";
      setRequestMessage(msg);
      showFeedback(msg, "error");
      setRequestSubmitting(false);
      return;
    }

    if (
      requestChanges.department_change &&
      !removeDepartment &&
      !selectedDepartment
    ) {
      const msg =
        "Please select a department, or choose to remove your current department.";
      setRequestMessage(msg);
      showFeedback(msg, "error");
      setRequestSubmitting(false);
      return;
    }
    if (requestChanges.office_change && !removeOffice && !selectedOffice) {
      const msg =
        "Please select an office, or choose to remove your current office.";
      setRequestMessage(msg);
      showFeedback(msg, "error");
      setRequestSubmitting(false);
      return;
    }
    if (requestChanges.role_update && !selectedRole) {
      const msg = "Please select a role.";
      setRequestMessage(msg);
      showFeedback(msg, "error");
      setRequestSubmitting(false);
      return;
    }
    if (requestChanges.position_update && !selectedPosition) {
      const msg = "Please select a position.";
      setRequestMessage(msg);
      showFeedback(msg, "error");
      setRequestSubmitting(false);
      return;
    }
    if (!requestDetails.trim()) {
      const msg = "Please provide details about your change request.";
      setRequestMessage(msg);
      showFeedback(msg, "error");
      setRequestSubmitting(false);
      return;
    }

    const finalDepartmentId = requestChanges.department_change
      ? removeDepartment
        ? null
        : selectedDepartment
      : profile?.department_id || null;
    const finalOfficeId = requestChanges.office_change
      ? removeOffice
        ? null
        : selectedOffice
      : profile?.office_id || null;

    if (!finalDepartmentId && !finalOfficeId) {
      const msg =
        "You must keep at least one of Department or Office set — you cannot remove both.";
      setRequestMessage(msg);
      showFeedback(msg, "error");
      setRequestSubmitting(false);
      return;
    }

    let hasActualChanges = false;
    if (
      requestChanges.department_change &&
      finalDepartmentId !== (profile?.department_id || null)
    )
      hasActualChanges = true;
    if (
      requestChanges.office_change &&
      finalOfficeId !== (profile?.office_id || null)
    )
      hasActualChanges = true;
    if (requestChanges.role_update && selectedRole !== profile?.role_id)
      hasActualChanges = true;
    if (
      requestChanges.position_update &&
      selectedPosition !== profile?.position_id
    )
      hasActualChanges = true;

    if (!hasActualChanges) {
      const msg =
        "The selected values are the same as your current profile. Please select different values to submit a change request.";
      setRequestMessage(msg);
      showFeedback(msg, "error");
      setRequestSubmitting(false);
      return;
    }

    try {
      const { data } = await apiClient.post("/profile/change-request", {
        changes: selectedChanges,
        department_id: requestChanges.department_change
          ? finalDepartmentId
          : null,
        office_id: requestChanges.office_change ? finalOfficeId : null,
        role_id: requestChanges.role_update ? selectedRole : null,
        position_id: requestChanges.position_update ? selectedPosition : null,
        details: requestDetails,
      });
      if (data.ok) {
        setRequestChanges({
          department_change: false,
          office_change: false,
          role_update: false,
          position_update: false,
        });
        setSelectedDepartment("");
        setSelectedOffice("");
        setSelectedRole("");
        setSelectedPosition("");
        setRemoveDepartment(false);
        setRemoveOffice(false);
        setRequestDetails("");
        setChangeProfileRequestOpen(false);
        showFeedback("Request submitted successfully!", "success");
      } else {
        setRequestMessage(data.message || "Request submission failed.");
        showFeedback(data.message || "Request submission failed.", "error");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || "Server error. Please try again.";
      setRequestMessage(msg);
      showFeedback(msg, "error");
    } finally {
      setRequestSubmitting(false);
    }
  };

  // ── Logout ───
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      if (logout) logout();
      else {
        localStorage.removeItem("token");
        navigate("/login");
      }
    }
  };

  // ══════════════════════════════════════════════════════
  // ── Analytics data fetching ──
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    setVenuesLoading(true);
    apiClient
      .get("/venues")
      .then((res) => {
        const list = res.data.venues || [];
        setVenues(list);
        if (list.length > 0) setSelectedVenueId(list[0].id);
      })
      .catch((err) => console.error("Failed to fetch venues:", err))
      .finally(() => setVenuesLoading(false));
  }, []);

  const fetchRangeData = useCallback(async (currentRange) => {
    setCampusOfficeLoading(true);
    setVenuePieLoading(true);
    setTaskStatsLoading(true);
    setDeptPerfLoading(true);
    setSchedulingLoading(true);
    setPersonalLoading(true);

    try {
      const res = await getCampusOfficeStats(currentRange);
      if (res.ok) setCampusOfficeData(res);
    } catch (err) {
      console.error("Campus/office stats error:", err);
    } finally {
      setCampusOfficeLoading(false);
    }

    try {
      const res = await getVenuePie(currentRange);
      if (res.ok) setVenuePie(res);
    } catch (err) {
      console.error("Venue pie error:", err);
    } finally {
      setVenuePieLoading(false);
    }

    try {
      const res = await getTaskStats(currentRange);
      if (res.ok) setTaskStats(res);
    } catch (err) {
      console.error("Task stats error:", err);
    } finally {
      setTaskStatsLoading(false);
    }

    try {
      const res = await getDepartmentOfficePerformance(currentRange);
      if (res.ok) setDeptPerf(res);
    } catch (err) {
      console.error("Department performance error:", err);
    } finally {
      setDeptPerfLoading(false);
    }

    try {
      const res = await getSchedulingConflicts(currentRange);
      if (res.ok) setSchedulingConflicts(res);
    } catch (err) {
      console.error("Scheduling conflicts error:", err);
    } finally {
      setSchedulingLoading(false);
    }

    try {
      const res = await getPersonalEvents(currentRange);
      if (res.ok) setPersonalEvents(res);
    } catch (err) {
      console.error("Personal events error:", err);
    } finally {
      setPersonalLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRangeData(range);
  }, [range, fetchRangeData]);

  useEffect(() => {
    if (!selectedVenueId) {
      setForecastLoading(false);
      setConflictForecast(null);
      return;
    }
    setForecastLoading(true);
    getConflictForecast(selectedVenueId, forecastDays)
      .then((res) => {
        if (res.ok) setConflictForecast(res);
      })
      .catch((err) => console.error("Conflict forecast error:", err))
      .finally(() => setForecastLoading(false));
  }, [selectedVenueId, forecastDays]);

  const selectedVenueName =
    venues.find((v) => v.id === selectedVenueId)?.name || "Venue";

  // ── Department/Office performance, merged with the full lookup list so
  // zero-performing entries still show, top 5 by default with Show More. ──
  const perfFullList = useMemo(() => {
    const lookupList = perfTab === "departments" ? departments : offices;
    const rawPerfList =
      (perfTab === "departments" ? deptPerf?.departments : deptPerf?.offices) ||
      [];
    if (lookupList.length === 0) return rawPerfList;
    return mergeWithZeroPerf(lookupList, rawPerfList);
  }, [perfTab, departments, offices, deptPerf]);

  const handlePerfTabChange = (tab) => {
    setPerfTab(tab);
    setPerfShowAll(false);
  };

  const renderKpiCard = (label, data) => {
    if (!data) return null;
    return (
      <div className={styles.kpiCard}>
        <span className={styles.kpiFlowLabel}>INSTITUTIONAL FLOW</span>
        <h3 className={styles.kpiTitle}>{label}</h3>
        <div className={styles.kpiGrid}>
          <div className={styles.kpiStatBlock}>
            <span className={styles.kpiStatLabel}>TOTAL</span>
            <span className={styles.kpiStatValue}>{data.total}</span>
          </div>
          <div className={styles.kpiStatBlock}>
            <span className={styles.kpiStatLabel}>PENDING</span>
            <span className={`${styles.kpiStatValue} ${styles.kpiGold}`}>
              {data.pending}
            </span>
          </div>
          <div className={styles.kpiStatBlock}>
            <span className={styles.kpiStatLabel}>DECLINED</span>
            <span className={`${styles.kpiStatValue} ${styles.kpiMaroon}`}>
              {data.declined}
            </span>
          </div>
          <div className={styles.kpiStatBlock}>
            <span className={styles.kpiStatLabel}>MISSED</span>
            <span className={`${styles.kpiStatValue} ${styles.kpiMaroon}`}>
              {data.missed}
            </span>
          </div>
        </div>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.chart}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="count" fill="#0f4a1e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <SkeletonBar
            w={96}
            h={96}
            r={999}
            style={{ margin: "0 auto 12px" }}
          />
          <SkeletonBar w={170} h={22} style={{ margin: "0 auto 8px" }} />
          <SkeletonBar w={210} h={14} style={{ margin: "0 auto" }} />
        </div>
        <div className={styles.infoGrid}>
          {[0, 1].map((i) => (
            <div key={i} className={styles.infoCard}>
              <SkeletonBar w={40} h={40} r={12} />
              <div style={{ flex: 1 }}>
                <SkeletonBar w="55%" h={10} style={{ marginBottom: 6 }} />
                <SkeletonBar w="80%" h={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  const displayUser = profile || user || {};
  const roleLine = [
    displayUser.role,
    displayUser.department,
    displayUser.office,
    displayUser.position,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.container}>
      {/* ─── Header with Avatar ─── */}
      <div className={styles.header}>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatar}>
            {displayUser.display_picture ? (
              <img
                src={displayUser.display_picture}
                alt="Profile"
                className={styles.avatarImg}
              />
            ) : (
              <FiUser size={40} />
            )}
            <button
              className={styles.avatarUploadBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              title="Change photo"
            >
              <FiCamera size={14} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={handlePhotoChange}
            />
          </div>
          {uploadingPhoto && (
            <div className={styles.uploadSpinner}>Uploading...</div>
          )}
        </div>
        <h1 className={styles.userName}>
          {displayUser.full_name || displayUser.username || "User"}
        </h1>
        <p className={styles.userRole}>{roleLine || "Member"}</p>
      </div>

      {/* ─── Info Cards ─── */}
      <div className={styles.infoGrid}>
        <div className={styles.infoCard}>
          <div className={styles.infoIcon}>
            <FiMapPin size={20} />
          </div>
          <div className={styles.infoContent}>
            <span className={styles.infoLabel}>Current Campus</span>
            <span className={styles.infoValue}>
              Polytechnic University of the Philippines
            </span>
          </div>
        </div>
        <div className={styles.infoCard}>
          <div className={styles.infoIcon}>
            <FiBriefcase size={20} />
          </div>
          <div className={styles.infoContent}>
            <span className={styles.infoLabel}>Current Branch</span>
            <span className={styles.infoValue}>Santo Tomas, Batangas</span>
          </div>
        </div>
      </div>

      {/* ─── Account Settings ─── */}
      <div className={styles.settingsSection}>
        <h2 className={styles.sectionTitle}>Account Settings</h2>

        <button
          className={styles.settingsItem}
          onClick={() => setEditModalOpen(true)}
        >
          <FiEdit className={styles.settingsIcon} />
          <div className={styles.settingsText}>
            <span className={styles.settingsLabel}>Personal Information</span>
            <span className={styles.settingsDesc}>
              Manage your profile details and contact info
            </span>
          </div>
          <FiChevronRight className={styles.settingsArrow} />
        </button>

        <button
          className={styles.settingsItem}
          onClick={() => setChangeProfileRequestOpen(true)}
        >
          <FiEdit className={styles.settingsIcon} />
          <div className={styles.settingsText}>
            <span className={styles.settingsLabel}>Request Profile Change</span>
            <span className={styles.settingsDesc}>
              Submit a request to modify your profile information
            </span>
          </div>
          <FiChevronRight className={styles.settingsArrow} />
        </button>
      </div>

      {/* ─── Logout Button ─── */}
      <button className={styles.logoutBtn} onClick={handleLogout}>
        <FiLogOut size={20} />
        <span>Log Out</span>
      </button>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Analytics & Performance ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className={styles.profileSeparator} />

      <div className={styles.analyticsRoot}>
        <div className={styles.analyticsHeaderRow}>
          <h2 className={styles.analyticsMainTitle}>
            <FiBarChart2 size={18} className={styles.analyticsMainIcon} />
            Analytics &amp; Performance
          </h2>
        </div>

        <div className={styles.stickyFilterWrap}>
          <select
            className={styles.rangeSelect}
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Conflict Forecast ── */}
        <div className={styles.sectionHeaderBlock}>
          <h3 className={styles.analyticsSectionTitle}>Conflict Forecast</h3>
          <p className={styles.analyticsSectionSubtitle}>
            Intelligent room allocation projections
          </p>
        </div>

        {venuesLoading ? (
          <SkeletonBar h={40} r={12} />
        ) : venues.length === 0 ? (
          <div className={styles.emptyNotice}>
            <FiInfo size={18} />
            <span>
              No venues have been added to the system yet — the forecast will
              appear once a venue is added.
            </span>
          </div>
        ) : (
          <>
            <div className={styles.filterRow}>
              <select
                className={styles.filterSelect}
                value={selectedVenueId}
                onChange={(e) => setSelectedVenueId(e.target.value)}
              >
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <select
                className={styles.filterSelect}
                value={forecastDays}
                onChange={(e) => setForecastDays(Number(e.target.value))}
              >
                {FORECAST_DAY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {forecastLoading ? (
              <>
                <CardSkeleton chartHeight={200} />
                <CardSkeleton chartHeight={90} />
              </>
            ) : !conflictForecast ? (
              <div className={styles.emptyNotice}>
                <FiInfo size={18} />
                <span>
                  Unable to load forecast data for this venue. Try selecting a
                  different venue.
                </span>
              </div>
            ) : (
              <>
                {conflictForecast.insights.totalConflictsLast4Weeks === 0 && (
                  <div className={styles.emptyNotice}>
                    <FiInfo size={18} />
                    <span>
                      No venue conflicts have been recorded for{" "}
                      <strong>{selectedVenueName}</strong> in the past 4 weeks —
                      the forecast will become meaningful once there's enough
                      data.
                    </span>
                  </div>
                )}

                <div className={styles.analyticsCard}>
                  <div className={styles.cardHeaderRow}>
                    <FiMapPin size={16} className={styles.cardHeaderIcon} />
                    <h4 className={styles.cardHeaderTitle}>
                      Conflicted Venue Trend
                    </h4>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={conflictForecast.trend}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f0f0f0"
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="actual"
                        name="Actual (4wk avg)"
                        fill="#7c0a02"
                        radius={[4, 4, 0, 0]}
                        barSize={12}
                      />
                      <Bar
                        dataKey="predicted"
                        name="Predicted"
                        fill="#e8a0a0"
                        radius={[4, 4, 0, 0]}
                        barSize={12}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className={styles.legendRow}>
                    <span className={styles.legendItem}>
                      <span
                        className={styles.legendDot}
                        style={{ background: "#7c0a02" }}
                      />
                      Actual (4wk avg)
                    </span>
                    <span className={styles.legendItem}>
                      <span
                        className={styles.legendDot}
                        style={{ background: "#e8a0a0" }}
                      />
                      Predicted
                    </span>
                  </div>
                </div>

                <div className={styles.analyticsCard}>
                  <div className={styles.cardHeaderRow}>
                    <FiTrendingUp size={16} className={styles.cardHeaderIcon} />
                    <h4 className={styles.cardHeaderTitle}>
                      Insights for {selectedVenueName}
                    </h4>
                  </div>
                  <div className={styles.insightGrid}>
                    <div className={styles.insightBlock}>
                      <span className={styles.insightLabel}>
                        TOTAL CONFLICTS
                      </span>
                      <span className={styles.insightValue}>
                        {conflictForecast.insights.totalConflictsLast4Weeks}
                      </span>
                      <span className={styles.insightSub}>Last 4 weeks</span>
                    </div>
                    <div className={styles.insightBlock}>
                      <span className={styles.insightLabel}>FORECAST</span>
                      <span
                        className={`${styles.insightValue} ${styles.insightRed}`}
                      >
                        {conflictForecast.insights.forecastTotal}
                      </span>
                      <span className={styles.insightSub}>
                        {conflictForecast.insights.percentChange >= 0
                          ? "+"
                          : ""}
                        {conflictForecast.insights.percentChange}% ·{" "}
                        {conflictForecast.insights.forecastDays} Days
                      </span>
                    </div>
                    <div className={styles.insightBlock}>
                      <span className={styles.insightLabel}>PEAK DAY</span>
                      <span className={styles.insightValue}>
                        {conflictForecast.insights.peakDay}
                      </span>
                    </div>
                  </div>

                  {conflictForecast.highRisk && (
                    <div className={styles.highRiskAlert}>
                      <FiAlertTriangle size={16} />
                      <span>
                        High risk on {conflictForecast.highRisk.day}:{" "}
                        {conflictForecast.highRisk.predicted} conflicts
                        predicted
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Venue Pie Chart ── */}
        {venuePieLoading ? (
          <CardSkeleton chartHeight={220} />
        ) : (
          <div className={styles.analyticsCard}>
            <div className={styles.cardHeaderRow}>
              <FiPieChart size={16} className={styles.cardHeaderIcon} />
              <h4 className={styles.cardHeaderTitle}>Venue Pie Chart</h4>
            </div>
            {!venuePie || venuePie.venues.length === 0 ? (
              <div className={styles.emptyNotice}>
                <FiInfo size={18} />
                <span>
                  No venue conflict data available for the selected time range.
                </span>
              </div>
            ) : (
              <>
                <div className={styles.pieWrapper}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={venuePie.venues}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {venuePie.venues.map((entry, idx) => (
                          <Cell
                            key={entry.id}
                            fill={PIE_COLORS[idx % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.pieCenterLabel}>
                    <span className={styles.pieCenterValue}>
                      {venuePie.total}
                    </span>
                    <span className={styles.pieCenterSub}>Total Conflict</span>
                  </div>
                </div>
                <div className={styles.pieLegendList}>
                  {venuePie.venues.map((v, idx) => (
                    <div key={v.id} className={styles.pieLegendRow}>
                      <span className={styles.pieLegendLeft}>
                        <span
                          className={styles.legendDot}
                          style={{
                            background: PIE_COLORS[idx % PIE_COLORS.length],
                          }}
                        />
                        {v.name}
                      </span>
                      <span className={styles.pieLegendPercent}>
                        {v.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Task Velocity ── */}
        {taskStatsLoading ? (
          <CardSkeleton chartHeight={140} />
        ) : (
          <div className={styles.analyticsCard}>
            <div className={styles.cardHeaderRow}>
              <FiCheckSquare size={16} className={styles.cardHeaderIcon} />
              <h4 className={styles.cardHeaderTitle}>Task Velocity</h4>
            </div>
            <p className={styles.cardHeaderSubtitle}>
              Campus &amp; Personal completion rate
            </p>

            <div className={styles.velocityStatsRow}>
              <div>
                <span
                  className={`${styles.velocityValue} ${styles.velocityGreen}`}
                >
                  {taskStats?.completed ?? 0}
                </span>
                <span className={styles.velocityLabel}>COMPLETED</span>
              </div>
              <div>
                <span
                  className={`${styles.velocityValue} ${styles.velocityRed}`}
                >
                  {taskStats?.missed ?? 0}
                </span>
                <span className={styles.velocityLabel}>MISSED</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={taskStats?.chart || []}>
                <defs>
                  <linearGradient
                    id="taskVelocityGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#taskVelocityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Department / Office Performance ── */}
        <div className={styles.analyticsCard}>
          <div className={styles.cardHeaderRow}>
            <FiActivity size={16} className={styles.cardHeaderIcon} />
            <h4 className={styles.cardHeaderTitle}>
              Department / Office Performance
            </h4>
          </div>
          <p className={styles.cardHeaderSubtitle}>
            Based on accepted attendees + event creator affiliation
          </p>

          <div className={styles.perfTabs}>
            <button
              type="button"
              className={`${styles.perfTab} ${perfTab === "departments" ? styles.perfTabActive : ""}`}
              onClick={() => handlePerfTabChange("departments")}
            >
              Departments
            </button>
            <button
              type="button"
              className={`${styles.perfTab} ${perfTab === "offices" ? styles.perfTabActive : ""}`}
              onClick={() => handlePerfTabChange("offices")}
            >
              Offices
            </button>
          </div>

          {deptPerfLoading ? (
            <div className={styles.perfList}>
              <ListRowSkeleton />
              <ListRowSkeleton />
              <ListRowSkeleton />
            </div>
          ) : perfFullList.length === 0 ? (
            <div className={styles.emptyNotice}>
              <FiInfo size={18} />
              <span>
                No {perfTab === "departments" ? "departments" : "offices"} are
                set up yet.
              </span>
            </div>
          ) : (
            <>
              {(() => {
                const maxCount = Math.max(
                  1,
                  ...perfFullList.map((l) => l.count),
                );
                const visible = perfShowAll
                  ? perfFullList
                  : perfFullList.slice(0, PERF_VISIBLE_COUNT);
                return (
                  <div className={styles.perfList}>
                    {visible.map((item) => (
                      <div key={item.id} className={styles.perfRow}>
                        <div className={styles.perfRowTop}>
                          <span className={styles.perfName}>{item.name}</span>
                          <span className={styles.perfCount}>{item.count}</span>
                        </div>
                        <div className={styles.perfBarTrack}>
                          <div
                            className={styles.perfBarFill}
                            style={{
                              width: `${(item.count / maxCount) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {perfFullList.length > PERF_VISIBLE_COUNT && (
                <button
                  type="button"
                  className={styles.perfShowMoreBtn}
                  onClick={() => setPerfShowAll((prev) => !prev)}
                >
                  {perfShowAll
                    ? "Show Less"
                    : `Show More (${perfFullList.length - PERF_VISIBLE_COUNT})`}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Scheduling Conflicts ── */}
        {schedulingLoading ? (
          <CardSkeleton chartHeight={110} />
        ) : (
          <div className={styles.analyticsCard}>
            <div className={styles.cardHeaderRow}>
              <FiAlertTriangle size={16} className={styles.cardHeaderIcon} />
              <h4 className={styles.cardHeaderTitle}>Scheduling Conflicts</h4>
            </div>
            <div className={styles.overlapsList}>
              <div className={`${styles.overlapItem} ${styles.overlapCampus}`}>
                <span className={styles.overlapLabel}>Campus Overlaps</span>
                <span className={styles.overlapValue}>
                  {schedulingConflicts?.campusOverlaps ?? 0}
                </span>
              </div>
              <div
                className={`${styles.overlapItem} ${styles.overlapDepartment}`}
              >
                <span className={styles.overlapLabel}>Department Overlaps</span>
                <span className={styles.overlapValue}>
                  {schedulingConflicts?.departmentOverlaps ?? 0}
                </span>
              </div>
              <div className={`${styles.overlapItem} ${styles.overlapPrivate}`}>
                <span className={styles.overlapLabel}>Private Overlaps</span>
                <span className={styles.overlapValue}>
                  {schedulingConflicts?.privateOverlaps ?? 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Personal Events ── */}
        {personalLoading ? (
          <CardSkeleton chartHeight={150} />
        ) : (
          <div className={styles.analyticsCard}>
            <div className={styles.cardHeaderRow}>
              <FiUser size={16} className={styles.cardHeaderIcon} />
              <h4 className={styles.cardHeaderTitle}>Personal Events</h4>
            </div>
            <div className={styles.ringWrapper}>
              <svg viewBox="0 0 160 160" className={styles.ringSvg}>
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="#e5f9ea"
                  strokeWidth="14"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="14"
                  strokeDasharray={2 * Math.PI * 70}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                />
              </svg>
              <div className={styles.ringCenter}>
                <span className={styles.ringValue}>
                  {personalEvents?.total ?? 0}
                </span>
                <span className={styles.ringLabel}>TOTAL EVENTS</span>
              </div>
            </div>
            <div className={styles.personalStatsRow}>
              <div className={styles.personalStatBox}>
                <span
                  className={`${styles.personalStatValue} ${styles.velocityGreen}`}
                >
                  {personalEvents?.ongoing ?? 0}
                </span>
                <span className={styles.personalStatLabel}>ACTIVE ONGOING</span>
              </div>
              <div className={styles.personalStatBox}>
                <span
                  className={`${styles.personalStatValue} ${styles.velocityRed}`}
                >
                  {personalEvents?.missed ?? 0}
                </span>
                <span className={styles.personalStatLabel}>EVENTS MISSED</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Institutional Flow (moved to the bottom) ── */}
        {campusOfficeLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            {renderKpiCard("Campus Events", campusOfficeData?.campus)}
            {renderKpiCard("Department Events", campusOfficeData?.department)}
            {renderKpiCard("Office Events", campusOfficeData?.office)}
          </>
        )}
      </div>

      {/* ─── Edit Profile Modal ─── */}
      {editModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setEditModalOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit Profile</h3>
              <button
                className={styles.modalClose}
                onClick={() => setEditModalOpen(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(sanitizeName(e.target.value))}
                  maxLength={MAX_NAME_LENGTH}
                  required
                />
                <div className={styles.fieldMetaRow}>
                  <span className={styles.hint}>
                    Letters and spaces only — no numbers, symbols, or emoji.
                  </span>
                  <span className={styles.charCount}>
                    {editName.length}/{MAX_NAME_LENGTH}
                  </span>
                </div>
              </div>
              {editMessage && (
                <p className={styles.modalError}>{editMessage}</p>
              )}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={editSubmitting}
                >
                  {editSubmitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Change Profile Request Modal ─── */}
      {changeProfileRequestOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setChangeProfileRequestOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Request Profile Change</h3>
              <button
                className={styles.modalClose}
                onClick={() => setChangeProfileRequestOpen(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleChangeProfileSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.checkboxGroupLabel}>
                  What to Change *
                </label>
                <div className={styles.checkboxGroup}>
                  {/* ── Department Change ── */}
                  <div
                    className={`${styles.changeCard} ${
                      requestChanges.department_change
                        ? styles.changeCardActive
                        : ""
                    }`}
                  >
                    <label className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={requestChanges.department_change}
                        onChange={() =>
                          handleChangeCheckbox("department_change")
                        }
                      />
                      <span>Department Change</span>
                    </label>
                    {requestChanges.department_change && (
                      <div className={styles.nestedFormGroup}>
                        <p className={styles.currentValueNote}>
                          Current department:{" "}
                          <strong>{profile?.department || "None"}</strong>
                        </p>
                        <label
                          className={`${styles.radioOption} ${
                            !removeDepartment ? styles.radioOptionSelected : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="departmentAction"
                            checked={!removeDepartment}
                            onChange={() => setRemoveDepartment(false)}
                          />
                          <span>Change to a different department</span>
                        </label>
                        {!removeDepartment && (
                          <select
                            value={selectedDepartment}
                            onChange={(e) =>
                              setSelectedDepartment(e.target.value)
                            }
                            required={
                              requestChanges.department_change &&
                              !removeDepartment
                            }
                          >
                            <option value="">Choose a department</option>
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <label
                          className={`${styles.radioOption} ${
                            removeDepartment ? styles.radioOptionSelected : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="departmentAction"
                            checked={removeDepartment}
                            onChange={() => {
                              setRemoveDepartment(true);
                              setSelectedDepartment("");
                            }}
                          />
                          <span>Remove my current department</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* ── Office Change ── */}
                  <div
                    className={`${styles.changeCard} ${
                      requestChanges.office_change
                        ? styles.changeCardActive
                        : ""
                    }`}
                  >
                    <label className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={requestChanges.office_change}
                        onChange={() => handleChangeCheckbox("office_change")}
                      />
                      <span>Office Change</span>
                    </label>
                    {requestChanges.office_change && (
                      <div className={styles.nestedFormGroup}>
                        <p className={styles.currentValueNote}>
                          Current office:{" "}
                          <strong>{profile?.office || "None"}</strong>
                        </p>
                        <label
                          className={`${styles.radioOption} ${
                            !removeOffice ? styles.radioOptionSelected : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="officeAction"
                            checked={!removeOffice}
                            onChange={() => setRemoveOffice(false)}
                          />
                          <span>Change to a different office</span>
                        </label>
                        {!removeOffice && (
                          <select
                            value={selectedOffice}
                            onChange={(e) => setSelectedOffice(e.target.value)}
                            required={
                              requestChanges.office_change && !removeOffice
                            }
                          >
                            <option value="">Choose an office</option>
                            {offices.map((office) => (
                              <option key={office.id} value={office.id}>
                                {office.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <label
                          className={`${styles.radioOption} ${
                            removeOffice ? styles.radioOptionSelected : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="officeAction"
                            checked={removeOffice}
                            onChange={() => {
                              setRemoveOffice(true);
                              setSelectedOffice("");
                            }}
                          />
                          <span>Remove my current office</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* ── Role Update ── */}
                  <div
                    className={`${styles.changeCard} ${
                      requestChanges.role_update ? styles.changeCardActive : ""
                    }`}
                  >
                    <label className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={requestChanges.role_update}
                        onChange={() => handleChangeCheckbox("role_update")}
                      />
                      <span>Role Update</span>
                    </label>
                    {requestChanges.role_update && (
                      <div className={styles.nestedFormGroup}>
                        <p className={styles.currentValueNote}>
                          Current role:{" "}
                          <strong>{profile?.role || "None"}</strong>
                        </p>
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          required={requestChanges.role_update}
                        >
                          <option value="">Choose a role</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* ── Position Update ── */}
                  <div
                    className={`${styles.changeCard} ${
                      requestChanges.position_update
                        ? styles.changeCardActive
                        : ""
                    }`}
                  >
                    <label className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={requestChanges.position_update}
                        onChange={() => handleChangeCheckbox("position_update")}
                      />
                      <span>Position Update</span>
                    </label>
                    {requestChanges.position_update && (
                      <div className={styles.nestedFormGroup}>
                        <p className={styles.currentValueNote}>
                          Current position:{" "}
                          <strong>{profile?.position || "None"}</strong>
                        </p>
                        <select
                          value={selectedPosition}
                          onChange={(e) => setSelectedPosition(e.target.value)}
                          required={requestChanges.position_update}
                        >
                          <option value="">Choose a position</option>
                          {positions.map((position) => (
                            <option key={position.id} value={position.id}>
                              {position.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Details / Description *</label>
                <textarea
                  value={requestDetails}
                  onChange={(e) =>
                    setRequestDetails(
                      e.target.value.slice(0, MAX_DESCRIPTION_LENGTH),
                    )
                  }
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  placeholder="Please provide details about your change request..."
                  rows="4"
                  required
                />
                <div className={styles.fieldMetaRow}>
                  <span className={styles.hint}>
                    Max {MAX_DESCRIPTION_LENGTH} characters.
                  </span>
                  <span className={styles.charCount}>
                    {requestDetails.length}/{MAX_DESCRIPTION_LENGTH}
                  </span>
                </div>
              </div>
              {requestMessage && (
                <p className={styles.modalError}>{requestMessage}</p>
              )}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setChangeProfileRequestOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={requestSubmitting}
                >
                  {requestSubmitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FeedbackModal
        message={feedback.message}
        type={feedback.type}
        onClose={() => setFeedback({ message: "", type: "success" })}
      />
    </div>
  );
}
