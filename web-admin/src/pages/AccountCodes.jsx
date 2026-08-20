import { useEffect, useState, useRef, useCallback } from "react";
import {
  generateCode,
  listCodes,
  getDepartments,
  getOffices,
  getRoles,
  getAvailablePositions,
} from "../api/admin";
import apiClient from "../api/client";
import {
  FiRefreshCw,
  FiCheck,
  FiX,
  FiMail,
  FiSearch,
  FiCopy,
  FiCode,
  FiClock,
  FiFilter,
  FiChevronDown,
} from "react-icons/fi";
import styles from "./AccountCodes.module.css";

// ── Skeleton helpers ────────────────────────────────────
function SkeletonSummaryValue() {
  return (
    <span className={`${styles.skeleton} ${styles.skeletonSummaryValue}`} />
  );
}

function SkeletonCodeRow() {
  return (
    <tr>
      <td className={styles.codeCell}>
        <div className={`${styles.skeleton} ${styles.skeletonCodeCell}`} />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "50px" }}
        />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "90px" }}
        />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "80px" }}
        />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "70px" }}
        />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "90px" }}
        />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "60px" }}
        />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "100px" }}
        />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "100px" }}
        />
      </td>
      <td>
        <div className={`${styles.skeleton} ${styles.skeletonBadgeCell}`} />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "70px" }}
        />
      </td>
    </tr>
  );
}

function SkeletonRequestCard() {
  return (
    <div className={styles.requestCard}>
      <div className={styles.requestHeader}>
        <div className={styles.requestUser}>
          <div className={`${styles.skeleton} ${styles.skeletonRequestName}`} />
          <div
            className={`${styles.skeleton} ${styles.skeletonRequestEmail}`}
          />
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonRequestBadge}`} />
      </div>
      <div className={styles.requestDetails}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div className={styles.detailRow} key={i}>
            <span className={styles.detailLabel}>&nbsp;</span>
            <div
              className={`${styles.skeleton} ${styles.skeletonDetailValue}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Simple searchable dropdown ──────────────────────────
function SearchableSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  return (
    <div ref={wrapperRef} className={styles.searchableWrapper}>
      <input
        type="text"
        className={styles.input}
        placeholder={placeholder}
        value={open ? search : selectedLabel}
        onFocus={() => {
          setOpen(true);
          setSearch("");
        }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <ul className={styles.dropdown}>
          {filtered.map((opt) => (
            <li
              key={opt.value}
              className={styles.dropdownItem}
              onClick={() => {
                onChange(opt.value);
                setSearch("");
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className={styles.dropdownEmpty}>No match</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────
export default function AccountCodes() {
  // ─── Account Codes State ──────────────────────────────
  const [codes, setCodes] = useState([]);
  const [depts, setDepts] = useState([]);
  const [offices, setOffices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [positions, setPositions] = useState([]);
  const [form, setForm] = useState({
    is_admin: false,
    department_id: "",
    office_id: "",
    role_id: "",
    position_id: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [codesLoading, setCodesLoading] = useState(false);

  // ─── Code Table Search & Sort ──────────────────────────
  const [codeSearch, setCodeSearch] = useState("");
  const [codeSort, setCodeSort] = useState("newest");

  // ─── Account Code Requests State ──────────────────────
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestFilter, setRequestFilter] = useState("pending");
  const [requestSearch, setRequestSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [approvingIds, setApprovingIds] = useState(new Set());

  // ─── Summary stats ─────────────────────────────────────
  const summaryStats = {
    totalCodes: codes.length,
    usedCodes: codes.filter((c) => c.status === "used").length,
    unusedCodes: codes.filter((c) => c.status === "unused").length,
    pendingRequests: requests.filter((r) => r.status === "pending").length,
    totalRequests: requests.length,
  };

  const summaryLoading = codesLoading || requestsLoading;

  // ─── Load Account Codes ──────────────────────────────
  const loadCodes = useCallback(async () => {
    setCodesLoading(true);
    try {
      const [codesRes, deptsRes, officesRes, rolesRes, posRes] =
        await Promise.all([
          listCodes(),
          getDepartments(),
          getOffices(),
          getRoles(),
          getAvailablePositions(),
        ]);
      setCodes(codesRes.codes || []);
      setDepts(deptsRes.items || []);
      setOffices(officesRes.items || []);
      setRoles(rolesRes.items || []);
      setPositions(posRes.positions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCodesLoading(false);
    }
  }, []);

  // ─── Load Account Code Requests ──────────────────────
  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const params = new URLSearchParams();
      if (requestFilter !== "all") params.append("status", requestFilter);
      if (requestSearch) params.append("search", requestSearch);

      const res = await apiClient.get(
        `/account-code-requests?${params.toString()}`,
      );
      if (res.data.ok) {
        setRequests(res.data.requests);
      }
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setRequestsLoading(false);
    }
  }, [requestFilter, requestSearch]);

  // ─── Initial Load ──────────────────────────────────────
  useEffect(() => {
    // Defer initial loads to avoid calling setState synchronously inside the
    // effect body which can trigger cascading renders.
    Promise.resolve().then(() => {
      loadCodes();
      loadRequests();
    });
  }, [loadCodes, loadRequests]);

  // ─── Handle Generate Code ─────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const payload = { is_admin: form.is_admin };
      if (!form.is_admin) {
        payload.department_id = form.department_id || undefined;
        payload.office_id = form.office_id;
        payload.role_id = form.role_id;
        payload.position_id = form.position_id || undefined;
      }
      const res = await generateCode(payload);
      setMessage(`Code generated: ${res.account_code.code}`);
      loadCodes();
      setForm({
        is_admin: false,
        department_id: "",
        office_id: "",
        role_id: "",
        position_id: "",
        _requestId: undefined,
      });
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to generate code.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Approve Request with confirmation ──────────────
  const handleApprove = async (requestId) => {
    if (approvingIds.has(requestId)) return;

    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    const confirmMsg = `Approve request from ${request.full_name || "User"} (${request.email})?`;
    if (!window.confirm(confirmMsg)) return;

    setApprovingIds((prev) => new Set(prev).add(requestId));
    try {
      const res = await apiClient.post(
        `/account-code-requests/${requestId}/approve`,
      );
      if (res.data.ok) {
        const req = res.data.request;
        setSelectedRequest({
          ...req,
          generated_code: res.data.generated_code,
          email: req.email,
          full_name: req.full_name,
        });
        setShowEmailModal(true);
        loadRequests();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve.");
    } finally {
      setApprovingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  // ─── Reject Request with confirmation ────────────────
  const handleReject = async (requestId) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    const notes = prompt(
      `Reject request from ${request.full_name || "User"} (${request.email}). Enter reason (optional):`,
    );
    if (notes === null) return; // cancel

    if (
      !window.confirm(
        `Confirm rejection for ${request.full_name || request.email}?`,
      )
    )
      return;

    try {
      const res = await apiClient.post(
        `/account-code-requests/${requestId}/reject`,
        { admin_notes: notes || null },
      );
      if (res.data.ok) {
        loadRequests();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject.");
    }
  };

  // ─── Send Code Email ──────────────────────────────────
  const handleSendCode = async () => {
    if (!selectedRequest) return;
    setEmailSending(true);
    try {
      const res = await apiClient.post(
        `/account-code-requests/${selectedRequest.id}/send-code`,
      );
      if (res.data.ok) {
        setShowEmailModal(false);
        setSelectedRequest(null);
        loadRequests();
        alert("Code sent successfully!");
      } else {
        alert(res.data.message || "Failed to send code.");
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to send code. Check SMTP configuration.",
      );
    } finally {
      setEmailSending(false);
    }
  };

  // ─── Copy code to clipboard ──────────────────────────
  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code).then(
      () => alert(`Copied: ${code}`),
      () => alert("Failed to copy code."),
    );
  };

  // ─── Get Status Badge ─────────────────────────────────
  const getStatusBadge = (status) => {
    const map = {
      pending: { class: styles.badgePending, label: "Pending" },
      approved: { class: styles.badgeApproved, label: "Approved" },
      rejected: { class: styles.badgeRejected, label: "Rejected" },
    };
    const s = map[status] || map.pending;
    return <span className={s.class}>{s.label}</span>;
  };

  // ─── Filter and Sort Codes ────────────────────────────
  const filteredCodes = codes.filter((code) => {
    const search = codeSearch.toLowerCase();
    if (!search) return true;
    return (
      code.code?.toLowerCase().includes(search) ||
      code.department?.toLowerCase().includes(search) ||
      code.office?.toLowerCase().includes(search) ||
      code.role?.toLowerCase().includes(search) ||
      code.position?.toLowerCase().includes(search) ||
      code.requested_by?.toLowerCase().includes(search) ||
      code.generated_by?.toLowerCase().includes(search)
    );
  });

  const sortedCodes = [...filteredCodes].sort((a, b) => {
    switch (codeSort) {
      case "newest":
        return new Date(b.created_at) - new Date(a.created_at);
      case "oldest":
        return new Date(a.created_at) - new Date(b.created_at);
      case "code_asc":
        return a.code.localeCompare(b.code);
      case "code_desc":
        return b.code.localeCompare(a.code);
      case "status_used":
        return a.status === "used" ? -1 : 1;
      case "status_unused":
        return a.status === "unused" ? -1 : 1;
      default:
        return 0;
    }
  });

  // ─── Prepare Options ──────────────────────────────────
  const positionOpts = positions.map((p) => ({
    value: p.id,
    label: `${p.name}${!p.allow_multiple ? " (single holder)" : ""}`,
  }));
  const deptOpts = depts.map((d) => ({ value: d.id, label: d.name }));
  const officeOpts = offices.map((o) => ({ value: o.id, label: o.name }));

  return (
    <div className={styles.parent}>
      {/* ─── TITLE SECTION ──────────────────────────────── */}
      <div className={styles.titleSection}>
        <h1 className={styles.pageTitle}>Account Code Management</h1>
        <p className={styles.pageSubtitle}>
          Generate account codes and manage code requests
        </p>
      </div>

      {/* ─── GENERATE SECTION ───────────────────────────── */}
      <div className={styles.generateSection}>
        {/* ── Summary Cards ── */}
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div
              className={styles.summaryIcon}
              style={{ background: "#dbeafe", color: "#2563eb" }}
            >
              <FiCode size={20} />
            </div>
            <div className={styles.summaryInfo}>
              {summaryLoading ? (
                <SkeletonSummaryValue />
              ) : (
                <span className={styles.summaryValue}>
                  {summaryStats.totalCodes}
                </span>
              )}
              <span className={styles.summaryLabel}>Total Codes</span>
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
              {summaryLoading ? (
                <SkeletonSummaryValue />
              ) : (
                <span className={styles.summaryValue}>
                  {summaryStats.usedCodes}
                </span>
              )}
              <span className={styles.summaryLabel}>Used</span>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div
              className={styles.summaryIcon}
              style={{ background: "#fef3c7", color: "#d97706" }}
            >
              <FiClock size={20} />
            </div>
            <div className={styles.summaryInfo}>
              {summaryLoading ? (
                <SkeletonSummaryValue />
              ) : (
                <span className={styles.summaryValue}>
                  {summaryStats.unusedCodes}
                </span>
              )}
              <span className={styles.summaryLabel}>Unused</span>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div
              className={styles.summaryIcon}
              style={{ background: "#fce7f3", color: "#db2777" }}
            >
              <FiMail size={20} />
            </div>
            <div className={styles.summaryInfo}>
              {summaryLoading ? (
                <SkeletonSummaryValue />
              ) : (
                <span className={styles.summaryValue}>
                  {summaryStats.pendingRequests}
                </span>
              )}
              <span className={styles.summaryLabel}>Pending Requests</span>
            </div>
          </div>
        </div>

        {/* ── Generate Form ── */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            Generate New Code
            {form._requestId && (
              <span className={styles.requestBadge}>
                From Request #{form._requestId.slice(0, 8)}
              </span>
            )}
          </h2>
          <form onSubmit={handleSubmit}>
            {/* Admin/User radio selection */}
            <div className={styles.toggleWrapper}>
              <div
                className={styles.radioGroup}
                role="radiogroup"
                aria-label="Code type"
              >
                <label
                  className={`${styles.radioLabel} ${form.is_admin ? styles.radioActive : ""}`}
                >
                  <input
                    type="radio"
                    name="codeType"
                    value="admin"
                    checked={form.is_admin === true}
                    onChange={() => setForm({ ...form, is_admin: true })}
                  />
                  <span>Admin Code</span>
                </label>

                <label
                  className={`${styles.radioLabel} ${!form.is_admin ? styles.radioActive : ""}`}
                >
                  <input
                    type="radio"
                    name="codeType"
                    value="user"
                    checked={form.is_admin === false}
                    onChange={() => setForm({ ...form, is_admin: false })}
                  />
                  <span>User Code</span>
                </label>
              </div>
            </div>

            {!form.is_admin && (
              <>
                <SearchableSelect
                  options={positionOpts}
                  value={form.position_id}
                  onChange={(val) => setForm({ ...form, position_id: val })}
                  placeholder="-- Select Position (if on the list) --"
                />
                <SearchableSelect
                  options={deptOpts}
                  value={form.department_id}
                  onChange={(val) => setForm({ ...form, department_id: val })}
                  placeholder="-- Select Department (if have) --"
                />
                <SearchableSelect
                  options={officeOpts}
                  value={form.office_id}
                  onChange={(val) => setForm({ ...form, office_id: val })}
                  placeholder="-- Select Office --"
                />
                <select
                  className={styles.select}
                  value={form.role_id}
                  onChange={(e) =>
                    setForm({ ...form, role_id: e.target.value })
                  }
                  required={!form.is_admin}
                >
                  <option value="">-- Select Role --</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button type="submit" disabled={loading} className={styles.btn}>
              {loading ? "Generating..." : "Generate Code"}
            </button>
          </form>
          {message && <p className={styles.msg}>{message}</p>}
        </div>
      </div>

      {/* ─── CODES SECTION ──────────────────────────────── */}
      <div className={styles.codesSection}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Generated Codes</h2>
            <button
              className={styles.refreshBtn}
              onClick={loadCodes}
              disabled={codesLoading}
            >
              <FiRefreshCw size={16} />
              {codesLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Search & Sort */}
          <div className={styles.tableControls}>
            <div className={styles.searchBar}>
              <FiSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search"
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
              />
            </div>
            <div className={styles.sortWrapper}>
              <FiFilter className={styles.filterIcon} />
              <select
                className={styles.sortSelect}
                value={codeSort}
                onChange={(e) => setCodeSort(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="code_asc">Code A→Z</option>
                <option value="code_desc">Code Z→A</option>
                <option value="status_used">Used First</option>
                <option value="status_unused">Unused First</option>
              </select>
              <FiChevronDown className={styles.sortChevron} />
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Office</th>
                  <th>Role</th>
                  <th>Position</th>
                  <th>Source</th>
                  <th>Requested By</th>
                  <th>Generated By</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {codesLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCodeRow key={i} />
                  ))
                ) : sortedCodes.length === 0 ? (
                  <tr>
                    <td colSpan="11" className={styles.noData}>
                      {codeSearch
                        ? "No matching codes found."
                        : "No codes yet."}
                    </td>
                  </tr>
                ) : (
                  sortedCodes.map((code) => (
                    <tr key={code.id}>
                      <td className={styles.codeCell}>
                        <span className={styles.hiddenCode}>••••••••</span>
                        <button
                          className={styles.copyBtn}
                          onClick={() => copyToClipboard(code.code)}
                          title="Copy code"
                        >
                          <FiCopy size={16} />
                        </button>
                      </td>
                      <td>{code.is_admin ? "Admin" : "User"}</td>
                      <td>{code.department || "—"}</td>
                      <td>{code.office || "—"}</td>
                      <td>{code.role || "—"}</td>
                      <td>{code.position || "—"}</td>
                      <td>
                        {code.source_type === "admin_generated"
                          ? "Admin"
                          : "Request"}
                      </td>
                      <td>{code.requested_by || "—"}</td>
                      <td>{code.generated_by || "—"}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            code.status === "used"
                              ? styles.statusUsed
                              : styles.statusUnused
                          }`}
                        >
                          {code.status}
                        </span>
                      </td>
                      <td>{new Date(code.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── REQUESTS SECTION ───────────────────────────── */}
      <div className={styles.requestsSection}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Account Code Requests</h2>
            <button
              className={styles.refreshBtn}
              onClick={loadRequests}
              disabled={requestsLoading}
            >
              <FiRefreshCw size={16} />
              {requestsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* ── Request Filters ── */}
          <div className={styles.requestFilters}>
            <div className={styles.searchBar}>
              <FiSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
              />
            </div>
            <select
              className={styles.statusFilter}
              value={requestFilter}
              onChange={(e) => setRequestFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* ── Request Cards ── */}
          {requestsLoading ? (
            <div className={styles.requestGrid}>
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonRequestCard key={i} />
              ))}
            </div>
          ) : (
            <div className={styles.requestGrid}>
              {requests.length === 0 ? (
                <p className={styles.noData}>No requests found.</p>
              ) : (
                requests.map((req) => (
                  <div key={req.id} className={styles.requestCard}>
                    <div className={styles.requestHeader}>
                      <div className={styles.requestUser}>
                        <span className={styles.requestName}>
                          {req.full_name || "N/A"}
                        </span>
                        <span className={styles.requestEmail}>{req.email}</span>
                      </div>
                      <div>{getStatusBadge(req.status)}</div>
                    </div>

                    <div className={styles.requestDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Department:</span>
                        <span className={styles.detailValue}>
                          {req.department_name || "—"}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Office:</span>
                        <span className={styles.detailValue}>
                          {req.office_name || "—"}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Role:</span>
                        <span className={styles.detailValue}>
                          {req.role_name || "—"}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Position:</span>
                        <span className={styles.detailValue}>
                          {req.position_name || "—"}
                        </span>
                      </div>
                      {req.description && (
                        <div
                          className={styles.detailRow}
                          style={{ gridColumn: "1 / -1" }}
                        >
                          <span className={styles.detailLabel}>Note:</span>
                          <span className={styles.requestDesc}>
                            {req.description}
                          </span>
                        </div>
                      )}
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Requested:</span>
                        <span className={styles.detailValue}>
                          {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {req.status === "pending" && (
                      <div className={styles.requestActions}>
                        <button
                          className={styles.approveBtn}
                          onClick={() => handleApprove(req.id)}
                          disabled={approvingIds.has(req.id)}
                        >
                          <FiCheck />{" "}
                          {approvingIds.has(req.id)
                            ? "Approving..."
                            : "Approve"}
                        </button>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => handleReject(req.id)}
                        >
                          <FiX /> Reject
                        </button>
                      </div>
                    )}

                    {req.status === "approved" && req.generated_code && (
                      <div className={styles.codeDisplay}>
                        <span className={styles.codeLabel}>Code:</span>
                        <span className={styles.codeValue}>
                          {req.generated_code}
                        </span>
                        {!req.code_sent_at ? (
                          <button
                            className={styles.sendBtn}
                            onClick={() => {
                              setSelectedRequest({
                                ...req,
                                email: req.email,
                                full_name: req.full_name,
                              });
                              setShowEmailModal(true);
                            }}
                          >
                            <FiMail /> Send
                          </button>
                        ) : (
                          <span className={styles.codeSent}>
                            ✓ Sent{" "}
                            {new Date(req.code_sent_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Email Modal ─── */}
      {showEmailModal && selectedRequest && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowEmailModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Send Account Code</h3>
              <button
                className={styles.modalClose}
                onClick={() => setShowEmailModal(false)}
              >
                <FiX size={24} />
              </button>
            </div>
            <div className={styles.modalContent}>
              <p>Send the generated account code to:</p>
              <div className={styles.recipientInfo}>
                <strong>{selectedRequest.full_name || "User"}</strong>
                <span>{selectedRequest.email}</span>
              </div>
              <div className={styles.codePreview}>
                <span className={styles.codeLabel}>Code:</span>
                <span className={styles.codeValue}>
                  {selectedRequest.generated_code}
                </span>
              </div>
              <p className={styles.modalNote}>
                The user will receive an email with their account code and
                registration link.
              </p>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowEmailModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.sendBtn}
                onClick={handleSendCode}
                disabled={emailSending}
              >
                {emailSending ? "Sending..." : "Send Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
