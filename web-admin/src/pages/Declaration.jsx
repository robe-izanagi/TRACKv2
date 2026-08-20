import { useEffect, useState, useMemo, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  getDepartments,
  createDepartment,
  toggleDepartment,
  deleteDepartment,
  updateDepartment,
  getOffices,
  createOffice,
  toggleOffice,
  deleteOffice,
  updateOffice,
  getDomains,
  addDomain,
  toggleDomain,
  deleteDomain,
  updateDomain,
  getPositions,
  createPosition,
  togglePosition,
  deletePosition,
  getPositionAssignments,
  reorderPositions,
  updatePosition,
} from "../api/admin";
import {
  FiSearch,
  FiRefreshCw,
  FiEdit,
  FiTrash2,
  FiPlus,
  FiCheck,
  FiX,
  FiLock,
  FiUser,
} from "react-icons/fi";
import FeedbackModal from "../components/common/FeedbackModal";
import styles from "./Declaration.module.css";

// ── Skeleton helpers ────────────────────────────────────
function SkeletonStatValue() {
  return (
    <span className={`${styles.skeleton} ${styles.skeletonSummaryValue}`} />
  );
}

function SkeletonTableRow({ columns = 5 }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i}>
          <div className={`${styles.skeleton} ${styles.skeletonCell}`} />
        </td>
      ))}
    </tr>
  );
}

function SkeletonPositionCard() {
  return (
    <div className={styles.positionCard}>
      <div className={styles.cardDragHandle}>
        <span className={`${styles.skeleton} ${styles.skeletonDragIcon}`} />
      </div>
      <div className={styles.cardContent}>
        <div className={`${styles.skeleton} ${styles.skeletonPositionName}`} />
        <div className={`${styles.skeleton} ${styles.skeletonPositionBadge}`} />
      </div>
    </div>
  );
}

export default function Declaration() {
  const [tab, setTab] = useState("departments");

  // ─── Data states ──────────────────────────────────────
  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);
  const [domains, setDomains] = useState([]);
  const [positions, setPositions] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // ─── Form states ──────────────────────────────────────
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newPosition, setNewPosition] = useState({
    name: "",
    allow_multiple: false,
  });

  // ─── Search states ────────────────────────────────────
  const [searchDepartments, setSearchDepartments] = useState("");
  const [searchOffices, setSearchOffices] = useState("");
  const [searchDomains, setSearchDomains] = useState("");
  const [searchPositions, setSearchPositions] = useState("");

  // ─── Edit states for tables ──────────────────────────
  const [editDeptId, setEditDeptId] = useState(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editOfficeId, setEditOfficeId] = useState(null);
  const [editOfficeName, setEditOfficeName] = useState("");
  const [editDomainId, setEditDomainId] = useState(null);
  const [editDomainValue, setEditDomainValue] = useState("");

  // ─── Edit state for positions (inline) ────────────────
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAllowMultiple, setEditAllowMultiple] = useState(false);

  // ─── Feedback state ───────────────────────────────────
  const [feedback, setFeedback] = useState({ message: "", type: "" });

  // ─── Loading ──────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  // ─── Show feedback ────────────────────────────────────
  const showFeedback = useCallback((message, type = "success") => {
    setFeedback({ message, type });
  }, []);

  const clearFeedback = () => {
    setFeedback({ message: "", type: "" });
  };

  // ─── Load data ────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, officeRes, domainRes, posRes, assignRes] =
        await Promise.all([
          getDepartments(),
          getOffices(),
          getDomains(),
          getPositions(),
          getPositionAssignments(),
        ]);
      setDepartments(deptRes.items || []);
      setOffices(officeRes.items || []);
      setDomains(domainRes.domains || []);
      setPositions(posRes.positions || []);
      setAssignments(assignRes.assignments || []);
    } catch (err) {
      console.error(err);
      showFeedback("Failed to load data.", "error");
    } finally {
      setLoading(false);
    }
  }, [showFeedback]);

  useEffect(() => {
    // Defer the initial load to avoid calling setState synchronously
    // within the effect body which can trigger cascading renders.
    Promise.resolve().then(() => load());
  }, [load]);

  // ─── Filter helpers ────────────────────────────────────
  const filterItems = (items, searchKey, searchField = "name") => {
    if (!searchKey) return items;
    return items.filter((item) =>
      item[searchField]?.toLowerCase().includes(searchKey.toLowerCase()),
    );
  };

  const filteredDepartments = useMemo(
    () => filterItems(departments, searchDepartments),
    [departments, searchDepartments],
  );

  const filteredOffices = useMemo(
    () => filterItems(offices, searchOffices),
    [offices, searchOffices],
  );

  const filteredDomains = useMemo(
    () => filterItems(domains, searchDomains, "domain"),
    [domains, searchDomains],
  );

  const filteredPositions = useMemo(
    () => filterItems(positions, searchPositions),
    [positions, searchPositions],
  );

  // ─── Position summary stats ───────────────────────────
  const takenPositionIds = useMemo(() => {
    const assignedIds = assignments
      .filter((a) => a.status === "active")
      .map((a) => a.position_id);
    return new Set(assignedIds);
  }, [assignments]);

  const positionStats = useMemo(() => {
    const total = positions.length;
    const active = positions.filter((p) => p.is_active).length;
    const inactive = positions.filter((p) => !p.is_active).length;
    const taken = positions.filter(
      (p) => !p.allow_multiple && takenPositionIds.has(p.id),
    ).length;
    return { total, active, inactive, taken };
  }, [positions, takenPositionIds]);

  const isPositionTaken = (posId) => takenPositionIds.has(posId);

  // ─── Add handlers ──────────────────────────────────────
  const handleAddDepartment = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createDepartment(newName.trim());
      setNewName("");
      load();
      showFeedback("Department added successfully.");
    } catch (err) {
      showFeedback(err.response?.data?.message || "Failed to add.", "error");
    }
  };

  const handleAddOffice = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createOffice(newName.trim());
      setNewName("");
      load();
      showFeedback("Office added successfully.");
    } catch (err) {
      showFeedback(err.response?.data?.message || "Failed to add.", "error");
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    try {
      await addDomain(newDomain.trim());
      setNewDomain("");
      load();
      showFeedback("Domain added successfully.");
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to add domain.",
        "error",
      );
    }
  };

  const handleAddPosition = async (e) => {
    e.preventDefault();
    if (!newPosition.name.trim()) return;
    try {
      await createPosition({
        name: newPosition.name.trim(),
        allow_multiple: newPosition.allow_multiple,
      });
      setNewPosition({ name: "", allow_multiple: false });
      load();
      showFeedback("Position added successfully.");
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to add position.",
        "error",
      );
    }
  };

  // ─── Toggle handlers ───────────────────────────────────
  const toggleItem = async (id, currentActive, type) => {
    try {
      if (type === "department") await toggleDepartment(id, !currentActive);
      else if (type === "office") await toggleOffice(id, !currentActive);
      else if (type === "domain") await toggleDomain(id);
      else if (type === "position") await togglePosition(id);
      load();
      showFeedback(`Status toggled successfully.`);
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to toggle status.",
        "error",
      );
    }
  };

  // ─── Delete handlers ───────────────────────────────────
  const handleDeleteDepartment = async (id) => {
    if (!window.confirm("Delete this department?")) return;
    try {
      await deleteDepartment(id);
      load();
      showFeedback("Department deleted.");
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to delete department.",
        "error",
      );
    }
  };

  const handleDeleteOffice = async (id) => {
    if (!window.confirm("Delete this office?")) return;
    try {
      await deleteOffice(id);
      load();
      showFeedback("Office deleted.");
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to delete office.",
        "error",
      );
    }
  };

  const handleDeleteDomain = async (id) => {
    if (!window.confirm("Remove this domain?")) return;
    try {
      await deleteDomain(id);
      load();
      showFeedback("Domain deleted.");
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to delete domain.",
        "error",
      );
    }
  };

  const handleDeletePosition = async (id) => {
    if (!window.confirm("Delete this position?")) return;
    try {
      await deletePosition(id);
      load();
      showFeedback("Position deleted.");
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to delete position.",
        "error",
      );
    }
  };

  // ─── Edit functions ────────────────────────────────────
  const startEditDept = (item) => {
    setEditDeptId(item.id);
    setEditDeptName(item.name);
  };
  const cancelEditDept = () => {
    setEditDeptId(null);
    setEditDeptName("");
  };
  const saveEditDept = async (id) => {
    if (!editDeptName.trim()) {
      showFeedback("Department name is required.", "error");
      return;
    }
    try {
      await updateDepartment(id, { name: editDeptName.trim() });
      setEditDeptId(null);
      load();
      showFeedback("Department updated.");
    } catch (err) {
      showFeedback(err.response?.data?.message || "Failed to update.", "error");
    }
  };

  const startEditOffice = (item) => {
    setEditOfficeId(item.id);
    setEditOfficeName(item.name);
  };
  const cancelEditOffice = () => {
    setEditOfficeId(null);
    setEditOfficeName("");
  };
  const saveEditOffice = async (id) => {
    if (!editOfficeName.trim()) {
      showFeedback("Office name is required.", "error");
      return;
    }
    try {
      await updateOffice(id, { name: editOfficeName.trim() });
      setEditOfficeId(null);
      load();
      showFeedback("Office updated.");
    } catch (err) {
      showFeedback(err.response?.data?.message || "Failed to update.", "error");
    }
  };

  const startEditDomain = (item) => {
    setEditDomainId(item.id);
    setEditDomainValue(item.domain);
  };
  const cancelEditDomain = () => {
    setEditDomainId(null);
    setEditDomainValue("");
  };
  const saveEditDomain = async (id) => {
    if (!editDomainValue.trim()) {
      showFeedback("Domain is required.", "error");
      return;
    }
    try {
      await updateDomain(id, { domain: editDomainValue.trim() });
      setEditDomainId(null);
      load();
      showFeedback("Domain updated.");
    } catch (err) {
      showFeedback(err.response?.data?.message || "Failed to update.", "error");
    }
  };

  const startEdit = (pos) => {
    setEditingId(pos.id);
    setEditName(pos.name);
    setEditAllowMultiple(pos.allow_multiple);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditAllowMultiple(false);
  };
  const saveEdit = async (id) => {
    if (!editName.trim()) {
      showFeedback("Position name is required.", "error");
      return;
    }
    try {
      await updatePosition(id, {
        name: editName.trim(),
        allow_multiple: editAllowMultiple,
      });
      setEditingId(null);
      load();
      showFeedback("Position updated.");
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to update position.",
        "error",
      );
    }
  };

  // ─── Drag and Drop ─────────────────────────────────────
  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(positions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      id: item.id,
      order: index,
    }));

    setPositions(items);

    try {
      await reorderPositions(updatedItems);
      showFeedback("Positions reordered successfully.");
      load();
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to reorder positions.",
        "error",
      );
      load();
    }
  };

  // ─── Render helpers ────────────────────────────────────
  const getStatusBadge = (isActive) => {
    return isActive ? (
      <span className={styles.badgeActive}>Active</span>
    ) : (
      <span className={styles.badgeInactive}>Inactive</span>
    );
  };

  // ─── Main render ──────────────────────────────────────
  return (
    <div className={styles.container}>
      <FeedbackModal
        message={feedback.message}
        type={feedback.type}
        onClose={clearFeedback}
      />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Declaration</h1>
          <p className={styles.subtitle}>
            Manage departments, offices, domains, and positions
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={load}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={tab === "departments" ? styles.activeTab : ""}
          onClick={() => setTab("departments")}
        >
          Departments
        </button>
        <button
          className={tab === "offices" ? styles.activeTab : ""}
          onClick={() => setTab("offices")}
        >
          Offices
        </button>
        <button
          className={tab === "domains" ? styles.activeTab : ""}
          onClick={() => setTab("domains")}
        >
          Domains
        </button>
        <button
          className={tab === "positions" ? styles.activeTab : ""}
          onClick={() => setTab("positions")}
        >
          Positions
        </button>
      </div>

      {/* ─── DEPARTMENTS ────────────────────────────────── */}
      {tab === "departments" && (
        <div className={styles.tabContent}>
          <div className={styles.topRow}>
            <div className={styles.topLeft}>
              <div className={styles.card}>
                <h3>Add Department</h3>
                <form onSubmit={handleAddDepartment} className={styles.addForm}>
                  <input
                    type="text"
                    placeholder="Department name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={styles.input}
                  />
                  <button type="submit" className={styles.btn}>
                    <FiPlus /> Add
                  </button>
                </form>
              </div>
            </div>
            <div className={styles.topRight}>
              <div className={styles.departmentStatsSection}>
                <h3>Department Stats</h3>
                <div className={styles.departmentStatsGrid}>
                  <div className={styles.summaryCard}>
                    <div
                      className={`${styles.summaryIcon} ${styles.summaryIconTotal}`}
                    >
                      <FiUser size={20} />
                    </div>
                    <div className={styles.summaryInfo}>
                      {loading ? (
                        <SkeletonStatValue />
                      ) : (
                        <span className={styles.summaryValue}>
                          {departments.length}
                        </span>
                      )}
                      <span className={styles.summaryLabel}>
                        Total Departments
                      </span>
                    </div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div
                      className={`${styles.summaryIcon} ${styles.summaryIconActive}`}
                    >
                      <FiCheck size={20} />
                    </div>
                    <div className={styles.summaryInfo}>
                      {loading ? (
                        <SkeletonStatValue />
                      ) : (
                        <span className={styles.summaryValue}>
                          {departments.filter((d) => d.is_active).length}
                        </span>
                      )}
                      <span className={styles.summaryLabel}>
                        Active Departments
                      </span>
                    </div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div
                      className={`${styles.summaryIcon} ${styles.summaryIconInactive}`}
                    >
                      <FiX size={20} />
                    </div>
                    <div className={styles.summaryInfo}>
                      {loading ? (
                        <SkeletonStatValue />
                      ) : (
                        <span className={styles.summaryValue}>
                          {departments.filter((d) => !d.is_active).length}
                        </span>
                      )}
                      <span className={styles.summaryLabel}>
                        Inactive Departments
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.tableSection}>
            <div className={styles.card}>
              <div className={styles.controls}>
                <div className={styles.searchBar}>
                  <FiSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search departments..."
                    value={searchDepartments}
                    onChange={(e) => setSearchDepartments(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Edit</th>
                      <th>Name</th>
                      <th>Created By</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonTableRow key={i} columns={5} />
                      ))
                    ) : filteredDepartments.length === 0 ? (
                      <tr>
                        <td colSpan="5" className={styles.noData}>
                          No departments found
                        </td>
                      </tr>
                    ) : (
                      filteredDepartments.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <button
                              onClick={() => startEditDept(item)}
                              className={styles.editBtn}
                            >
                              <FiEdit size={14} />
                            </button>
                          </td>
                          <td>
                            {editDeptId === item.id ? (
                              <div className={styles.inlineEdit}>
                                <input
                                  type="text"
                                  value={editDeptName}
                                  onChange={(e) =>
                                    setEditDeptName(e.target.value)
                                  }
                                  className={styles.inlineInput}
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveEditDept(item.id)}
                                  className={styles.saveEditBtn}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditDept}
                                  className={styles.cancelEditBtn}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              item.name
                            )}
                          </td>
                          <td>{item.created_by_username || "—"}</td>
                          <td>{getStatusBadge(item.is_active)}</td>
                          <td>
                            <button
                              onClick={() =>
                                toggleItem(
                                  item.id,
                                  item.is_active,
                                  "department",
                                )
                              }
                              className={styles.toggleBtn}
                            >
                              {item.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleDeleteDepartment(item.id)}
                              className={styles.dangerBtn}
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── OFFICES ────────────────────────────────────── */}
      {tab === "offices" && (
        <div className={styles.tabContent}>
          <div className={styles.topRow}>
            <div className={styles.topLeft}>
              <div className={styles.card}>
                <h3>Add Office</h3>
                <form onSubmit={handleAddOffice} className={styles.addForm}>
                  <input
                    type="text"
                    placeholder="Office name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={styles.input}
                  />
                  <button type="submit" className={styles.btn}>
                    <FiPlus /> Add
                  </button>
                </form>
              </div>
            </div>
            <div className={styles.topRight}>
              <div className={styles.departmentStatsSection}>
                <h3>Office Stats</h3>
                <div className={styles.departmentStatsGrid}>
                  <div className={styles.summaryCard}>
                    <div
                      className={`${styles.summaryIcon} ${styles.summaryIconTotal}`}
                    >
                      <FiUser size={20} />
                    </div>
                    <div className={styles.summaryInfo}>
                      {loading ? (
                        <SkeletonStatValue />
                      ) : (
                        <span className={styles.summaryValue}>
                          {offices.length}
                        </span>
                      )}
                      <span className={styles.summaryLabel}>Total Offices</span>
                    </div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div
                      className={`${styles.summaryIcon} ${styles.summaryIconActive}`}
                    >
                      <FiCheck size={20} />
                    </div>
                    <div className={styles.summaryInfo}>
                      {loading ? (
                        <SkeletonStatValue />
                      ) : (
                        <span className={styles.summaryValue}>
                          {offices.filter((o) => o.is_active).length}
                        </span>
                      )}
                      <span className={styles.summaryLabel}>
                        Active Offices
                      </span>
                    </div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div
                      className={`${styles.summaryIcon} ${styles.summaryIconInactive}`}
                    >
                      <FiX size={20} />
                    </div>
                    <div className={styles.summaryInfo}>
                      {loading ? (
                        <SkeletonStatValue />
                      ) : (
                        <span className={styles.summaryValue}>
                          {offices.filter((o) => !o.is_active).length}
                        </span>
                      )}
                      <span className={styles.summaryLabel}>
                        Inactive Offices
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.tableSection}>
            <div className={styles.card}>
              <div className={styles.controls}>
                <div className={styles.searchBar}>
                  <FiSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search offices..."
                    value={searchOffices}
                    onChange={(e) => setSearchOffices(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Edit</th>
                      <th>Name</th>
                      <th>Created By</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonTableRow key={i} columns={5} />
                      ))
                    ) : filteredOffices.length === 0 ? (
                      <tr>
                        <td colSpan="5" className={styles.noData}>
                          No offices found
                        </td>
                      </tr>
                    ) : (
                      filteredOffices.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <button
                              onClick={() => startEditOffice(item)}
                              className={styles.editBtn}
                            >
                              <FiEdit size={14} />
                            </button>
                          </td>
                          <td>
                            {editOfficeId === item.id ? (
                              <div className={styles.inlineEdit}>
                                <input
                                  type="text"
                                  value={editOfficeName}
                                  onChange={(e) =>
                                    setEditOfficeName(e.target.value)
                                  }
                                  className={styles.inlineInput}
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveEditOffice(item.id)}
                                  className={styles.saveEditBtn}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditOffice}
                                  className={styles.cancelEditBtn}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              item.name
                            )}
                          </td>
                          <td>{item.created_by_username || "—"}</td>
                          <td>{getStatusBadge(item.is_active)}</td>
                          <td>
                            <button
                              onClick={() =>
                                toggleItem(item.id, item.is_active, "office")
                              }
                              className={styles.toggleBtn}
                            >
                              {item.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleDeleteOffice(item.id)}
                              className={styles.dangerBtn}
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DOMAINS ────────────────────────────────────── */}
      {tab === "domains" && (
        <div className={styles.tabContent}>
          <div className={styles.topRow}>
            <div className={styles.topLeft}>
              <div className={styles.card}>
                <h3>Add Allowed Domain</h3>
                <form onSubmit={handleAddDomain} className={styles.addForm}>
                  <input
                    type="text"
                    placeholder="e.g., pup.edu.ph"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className={styles.input}
                  />
                  <button type="submit" className={styles.btn}>
                    <FiPlus /> Add
                  </button>
                </form>
              </div>
            </div>
            <div className={styles.topRight}>
              <div className={styles.departmentStatsSection}>
                <h3>Domain Stats</h3>
                <div className={styles.departmentStatsGrid}>
                  <div className={styles.summaryCard}>
                    <div
                      className={`${styles.summaryIcon} ${styles.summaryIconTotal}`}
                    >
                      <FiUser size={20} />
                    </div>
                    <div className={styles.summaryInfo}>
                      {loading ? (
                        <SkeletonStatValue />
                      ) : (
                        <span className={styles.summaryValue}>
                          {domains.length}
                        </span>
                      )}
                      <span className={styles.summaryLabel}>Total Domains</span>
                    </div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div
                      className={`${styles.summaryIcon} ${styles.summaryIconActive}`}
                    >
                      <FiCheck size={20} />
                    </div>
                    <div className={styles.summaryInfo}>
                      {loading ? (
                        <SkeletonStatValue />
                      ) : (
                        <span className={styles.summaryValue}>
                          {domains.filter((d) => d.is_active).length}
                        </span>
                      )}
                      <span className={styles.summaryLabel}>
                        Active Domains
                      </span>
                    </div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div
                      className={`${styles.summaryIcon} ${styles.summaryIconInactive}`}
                    >
                      <FiX size={20} />
                    </div>
                    <div className={styles.summaryInfo}>
                      {loading ? (
                        <SkeletonStatValue />
                      ) : (
                        <span className={styles.summaryValue}>
                          {domains.filter((d) => !d.is_active).length}
                        </span>
                      )}
                      <span className={styles.summaryLabel}>
                        Inactive Domains
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.tableSection}>
            <div className={styles.card}>
              <div className={styles.controls}>
                <div className={styles.searchBar}>
                  <FiSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search domains..."
                    value={searchDomains}
                    onChange={(e) => setSearchDomains(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Edit</th>
                      <th>Domain</th>
                      <th>Created By</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonTableRow key={i} columns={5} />
                      ))
                    ) : filteredDomains.length === 0 ? (
                      <tr>
                        <td colSpan="5" className={styles.noData}>
                          No domains found
                        </td>
                      </tr>
                    ) : (
                      filteredDomains.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <button
                              onClick={() => startEditDomain(item)}
                              className={styles.editBtn}
                            >
                              <FiEdit size={14} />
                            </button>
                          </td>
                          <td>
                            {editDomainId === item.id ? (
                              <div className={styles.inlineEdit}>
                                <input
                                  type="text"
                                  value={editDomainValue}
                                  onChange={(e) =>
                                    setEditDomainValue(e.target.value)
                                  }
                                  className={styles.inlineInput}
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveEditDomain(item.id)}
                                  className={styles.saveEditBtn}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditDomain}
                                  className={styles.cancelEditBtn}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              item.domain
                            )}
                          </td>
                          <td>{item.created_by_username || "—"}</td>
                          <td>{getStatusBadge(item.is_active)}</td>
                          <td>
                            <button
                              onClick={() =>
                                toggleItem(item.id, item.is_active, "domain")
                              }
                              className={styles.toggleBtn}
                            >
                              {item.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleDeleteDomain(item.id)}
                              className={styles.dangerBtn}
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── POSITIONS ──────────────────────────────────── */}
      {tab === "positions" && (
        <div className={styles.tabContentPositions}>
          {/* ── Summary Cards ── */}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <div
                className={styles.summaryIcon}
                style={{ background: "#dbeafe", color: "#2563eb" }}
              >
                <FiPlus size={20} />
              </div>
              <div className={styles.summaryInfo}>
                {loading ? (
                  <SkeletonStatValue />
                ) : (
                  <span className={styles.summaryValue}>
                    {positionStats.total}
                  </span>
                )}
                <span className={styles.summaryLabel}>Total Positions</span>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div
                className={styles.summaryIcon}
                style={{ background: "#d1fae5", color: "#059669" }}
              >
                <FiCheck size={20} />
              </div>
              <div className={styles.summaryInfo}>
                {loading ? (
                  <SkeletonStatValue />
                ) : (
                  <span className={styles.summaryValue}>
                    {positionStats.active}
                  </span>
                )}
                <span className={styles.summaryLabel}>Active Positions</span>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div
                className={styles.summaryIcon}
                style={{ background: "#fee2e2", color: "#dc2626" }}
              >
                <FiX size={20} />
              </div>
              <div className={styles.summaryInfo}>
                {loading ? (
                  <SkeletonStatValue />
                ) : (
                  <span className={styles.summaryValue}>
                    {positionStats.inactive}
                  </span>
                )}
                <span className={styles.summaryLabel}>Inactive Positions</span>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div
                className={styles.summaryIcon}
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <FiLock size={20} />
              </div>
              <div className={styles.summaryInfo}>
                {loading ? (
                  <SkeletonStatValue />
                ) : (
                  <span className={styles.summaryValue}>
                    {positionStats.taken}
                  </span>
                )}
                <span className={styles.summaryLabel}>Taken Positions</span>
              </div>
            </div>
          </div>

          {/* Left Panel: Add Form + All Positions (Cards) */}
          <div className={styles.leftPanelPositions}>
            <div className={styles.card}>
              <h3>Add Position</h3>
              <form onSubmit={handleAddPosition} className={styles.addForm}>
                <input
                  type="text"
                  placeholder="Position name"
                  value={newPosition.name}
                  onChange={(e) =>
                    setNewPosition({ ...newPosition, name: e.target.value })
                  }
                  className={styles.input}
                />
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={newPosition.allow_multiple}
                    onChange={(e) =>
                      setNewPosition({
                        ...newPosition,
                        allow_multiple: e.target.checked,
                      })
                    }
                  />
                  Multiple holders
                </label>
                <button type="submit" className={styles.btn}>
                  <FiPlus /> Add
                </button>
              </form>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>All Positions</h3>
                <div className={styles.searchBarSmall}>
                  <FiSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search positions..."
                    value={searchPositions}
                    onChange={(e) => setSearchPositions(e.target.value)}
                  />
                </div>
              </div>
              {loading ? (
                <div className={styles.positionList}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonPositionCard key={i} />
                  ))}
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="positions">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={styles.positionList}
                      >
                        {filteredPositions.map((pos, index) => {
                          const taken =
                            !pos.allow_multiple && isPositionTaken(pos.id);
                          return (
                            <Draggable
                              key={pos.id}
                              draggableId={pos.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`${styles.positionCard} ${
                                    snapshot.isDragging ? styles.dragging : ""
                                  } ${taken ? styles.taken : ""}`}
                                >
                                  <div
                                    className={styles.cardDragHandle}
                                    {...provided.dragHandleProps}
                                  >
                                    <span className={styles.dragIcon}>⠿</span>
                                    <span className={styles.positionOrder}>
                                      #{index + 1}
                                    </span>
                                  </div>

                                  {editingId === pos.id ? (
                                    <div className={styles.editForm}>
                                      <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) =>
                                          setEditName(e.target.value)
                                        }
                                        className={styles.editInput}
                                        autoFocus
                                      />
                                      <label className={styles.checkboxRow}>
                                        <input
                                          type="checkbox"
                                          checked={editAllowMultiple}
                                          onChange={(e) =>
                                            setEditAllowMultiple(
                                              e.target.checked,
                                            )
                                          }
                                        />
                                        Multiple
                                      </label>
                                      <button
                                        onClick={() => saveEdit(pos.id)}
                                        className={styles.saveEditBtn}
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={cancelEdit}
                                        className={styles.cancelEditBtn}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className={styles.cardContent}>
                                        <span className={styles.positionName}>
                                          {pos.name}
                                        </span>
                                        <span className={styles.positionBadge}>
                                          {pos.allow_multiple
                                            ? "Multiple"
                                            : "Single"}
                                        </span>
                                        {taken && (
                                          <span className={styles.takenBadge}>
                                            Taken
                                          </span>
                                        )}
                                        {getStatusBadge(pos.is_active)}
                                        <span className={styles.createdBySmall}>
                                          <FiUser size={12} />
                                          {pos.created_by_username || "System"}
                                        </span>
                                      </div>
                                      <div className={styles.cardActions}>
                                        <button
                                          onClick={() => startEdit(pos)}
                                          className={styles.editBtn}
                                        >
                                          <FiEdit size={14} />
                                        </button>
                                        <button
                                          onClick={() =>
                                            toggleItem(
                                              pos.id,
                                              pos.is_active,
                                              "position",
                                            )
                                          }
                                          className={styles.toggleBtn}
                                          disabled={taken && pos.is_active}
                                        >
                                          {pos.is_active
                                            ? "Deactivate"
                                            : "Activate"}
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDeletePosition(pos.id)
                                          }
                                          className={styles.dangerBtn}
                                          disabled={taken}
                                        >
                                          <FiTrash2 size={14} />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
              {filteredPositions.length === 0 && !loading && (
                <p className={styles.noData}>No positions found</p>
              )}
            </div>
          </div>

          {/* Right Panel: Current Assignments */}
          <div className={styles.rightPanelPositions}>
            <div className={styles.card}>
              <h3>Current Assignments</h3>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonTableRow key={i} columns={3} />
                      ))
                    ) : assignments.length === 0 ? (
                      <tr>
                        <td colSpan="4" className={styles.noData}>
                          No active assignments
                        </td>
                      </tr>
                    ) : (
                      assignments.map((ass) => (
                        <tr key={ass.id}>
                          <td>{ass.Position?.name || "—"}</td>
                          <td>{ass.User?.email || "—"}</td>
                          <td>
                            <span className={styles.badgeActive}>Active</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
