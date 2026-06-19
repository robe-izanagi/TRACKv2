import { useEffect, useState } from "react";
import {
  getDepartments,
  createDepartment,
  toggleDepartment,
  getOffices,
  createOffice,
  toggleOffice,
  getDomains,
  addDomain,
  toggleDomain,
  deleteDomain,
  getPositions,
  createPosition,
  togglePosition,
  deletePosition,
  getPositionAssignments,
  removeAssignment,
} from "../api/admin";
import styles from "./Declaration.module.css";

export default function Declaration() {
  const [tab, setTab] = useState("departments"); // departments | offices | domains | positions
  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);
  const [domains, setDomains] = useState([]);
  const [positions, setPositions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newPosition, setNewPosition] = useState({
    name: "",
    weight: 1,
    allow_multiple: false,
  });
  const [message, setMessage] = useState("");

  const load = async () => {
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
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ── Generic add for departments / offices ──
  const addItem = async () => {
    if (!newName.trim()) return;
    try {
      if (tab === "departments") await createDepartment(newName.trim());
      else if (tab === "offices") await createOffice(newName.trim());
      setNewName("");
      load();
      setMessage("Added successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to add.");
    }
  };

  // ── Domain add ──
  const addDomainItem = async () => {
    if (!newDomain.trim()) return;
    try {
      await addDomain(newDomain.trim());
      setNewDomain("");
      load();
      setMessage("Domain added.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to add domain.");
    }
  };

  // ── Position add ──
  const addPositionItem = async () => {
    if (!newPosition.name.trim()) return;
    try {
      await createPosition(newPosition);
      setNewPosition({ name: "", weight: 1, allow_multiple: false });
      load();
      setMessage("Position added.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to add position.");
    }
  };

  // ── Toggle functions ──
  const toggleItem = async (id, currentActive) => {
    try {
      if (tab === "departments") await toggleDepartment(id, !currentActive);
      else if (tab === "offices") await toggleOffice(id, !currentActive);
      else if (tab === "domains") await toggleDomain(id);
      else if (tab === "positions") await togglePosition(id);
      load();
    } catch (err) {
      setMessage("Failed to toggle status.");
    }
  };

  const handleDeleteDomain = async (id) => {
    if (!window.confirm("Remove this domain?")) return;
    try {
      await deleteDomain(id);
      load();
    } catch (err) {
      setMessage("Failed to delete domain.");
    }
  };

  const handleDeletePosition = async (id) => {
    if (!window.confirm("Delete this position?")) return;
    try {
      await deletePosition(id);
      load();
    } catch (err) {
      setMessage("Failed to delete position.");
    }
  };

  const handleRemoveAssignment = async (id) => {
    if (!window.confirm("Remove this assignment?")) return;
    try {
      await removeAssignment(id);
      load();
    } catch (err) {
      setMessage("Failed to remove assignment.");
    }
  };

  return (
    <div>
      <h1>Declaration</h1>
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

      {/* ── Departments / Offices ── */}
      {(tab === "departments" || tab === "offices") && (
        <div className={styles.card}>
          <div className={styles.addForm}>
            <input
              type="text"
              placeholder={`New ${tab.slice(0, -1)} name`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={styles.input}
            />
            <button onClick={addItem} className={styles.btn}>
              Add
            </button>
          </div>
          {message && <p className={styles.msg}>{message}</p>}
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(tab === "departments" ? departments : offices).map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.is_active ? "Active" : "Inactive"}</td>
                  <td>
                    <button onClick={() => toggleItem(item.id, item.is_active)}>
                      {item.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {(tab === "departments" ? departments : offices).length === 0 && (
                <tr>
                  <td colSpan="3">No items found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Domains ── */}
      {tab === "domains" && (
        <div className={styles.card}>
          <div className={styles.addForm}>
            <input
              type="text"
              placeholder="e.g., pup.edu.ph"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className={styles.input}
            />
            <button onClick={addDomainItem} className={styles.btn}>
              Add Domain
            </button>
          </div>
          {message && <p className={styles.msg}>{message}</p>}
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.id}>
                  <td>{d.domain}</td>
                  <td>{d.is_active ? "Active" : "Inactive"}</td>
                  <td>
                    <button onClick={() => toggleItem(d.id, d.is_active)}>
                      {d.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDeleteDomain(d.id)}
                      style={{
                        marginLeft: 8,
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr>
                  <td colSpan="3">No domains added.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Positions ── */}
      {tab === "positions" && (
        <>
          <div className={styles.card}>
            <h3>Add Position</h3>
            <div className={styles.addForm}>
              <input
                type="text"
                placeholder="Position name (e.g. Chancellor)"
                value={newPosition.name}
                onChange={(e) =>
                  setNewPosition({ ...newPosition, name: e.target.value })
                }
                className={styles.input}
              />
              <input
                type="number"
                placeholder="Weight (1-5)"
                value={newPosition.weight}
                min="1"
                max="5"
                onChange={(e) =>
                  setNewPosition({
                    ...newPosition,
                    weight: parseInt(e.target.value) || 1,
                  })
                }
                className={styles.input}
                style={{ width: 80 }}
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
                Allow multiple holders
              </label>
              <button onClick={addPositionItem} className={styles.btn}>
                Add Position
              </button>
            </div>
            {message && <p className={styles.msg}>{message}</p>}
          </div>

          {/* Positions list */}
          <div className={styles.card}>
            <h3>All Positions</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Weight</th>
                  <th>Multiple</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id}>
                    <td>{pos.name}</td>
                    <td>{pos.weight}</td>
                    <td>{pos.allow_multiple ? "Yes" : "No"}</td>
                    <td>{pos.is_active ? "Active" : "Inactive"}</td>
                    <td>
                      <button onClick={() => toggleItem(pos.id, pos.is_active)}>
                        {pos.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDeletePosition(pos.id)}
                        style={{
                          marginLeft: 8,
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {positions.length === 0 && (
                  <tr>
                    <td colSpan="5">No positions defined.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Assignments list */}
          <div className={styles.card}>
            <h3>Current Assignments</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Position</th>
                  <th>User Email</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((ass) => (
                  <tr key={ass.id}>
                    <td>{ass.Position?.name}</td>
                    <td>{ass.User?.email}</td>
                    <td>{ass.status}</td>
                    <td>
                      <button
                        onClick={() => handleRemoveAssignment(ass.id)}
                        style={{
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 && (
                  <tr>
                    <td colSpan="4">No active assignments.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
