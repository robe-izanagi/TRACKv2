import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../api/client";
import {
  FiUser,
  FiMapPin,
  FiBriefcase,
  FiEdit,
  FiLock,
  FiLogOut,
  FiLink,
  FiChevronRight,
  FiCamera,
  FiX,
} from "react-icons/fi";
import styles from "./Profile.module.css";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editMessage, setEditMessage] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  // Profile picture
  const fileInputRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  // Edit Profile
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
      } else {
        setEditMessage(data.message || "Update failed.");
      }
    } catch (err) {
      setEditMessage(err.response?.data?.message || "Server error.");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Change Password
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage("Password must be at least 6 characters.");
      return;
    }
    setPasswordSubmitting(true);
    setPasswordMessage("");
    try {
      const { data } = await apiClient.put("/auth/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (data.ok) {
        setPasswordModalOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        alert("Password changed successfully.");
      } else {
        setPasswordMessage(data.message || "Update failed.");
      }
    } catch (err) {
      setPasswordMessage(err.response?.data?.message || "Server error.");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // Upload Profile Picture
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Only JPG, PNG, and WEBP images are allowed.");
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
        } else {
          alert("Failed to update profile picture.");
        }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error uploading image.");
      setUploadingPhoto(false);
    }
    e.target.value = "";
  };

  // Logout
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      if (logout) logout();
      else {
        localStorage.removeItem("token");
        navigate("/login");
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p>Loading profile...</p>
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
        <p className={styles.userRole}>
          {displayUser.role || "Member"}
          {displayUser.department && ` · ${displayUser.department}`}
        </p>
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
          onClick={() => setGoogleModalOpen(true)}
        >
          <FiLink className={styles.settingsIcon} />
          <div className={styles.settingsText}>
            <span className={styles.settingsLabel}>Link Google Account</span>
            <span className={styles.settingsDesc}>
              Link Your Google Account
            </span>
          </div>
          <FiChevronRight className={styles.settingsArrow} />
        </button>

        <button
          className={styles.settingsItem}
          onClick={() => setPasswordModalOpen(true)}
        >
          <FiLock className={styles.settingsIcon} />
          <div className={styles.settingsText}>
            <span className={styles.settingsLabel}>Change Password</span>
            <span className={styles.settingsDesc}>
              Update your security credentials
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

      {/* ─── Modals ─── */}
      {/* Edit Profile Modal */}
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
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
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

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setPasswordModalOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Change Password</h3>
              <button
                className={styles.modalClose}
                onClick={() => setPasswordModalOpen(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit}>
              <div className={styles.formGroup}>
                <label>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength="6"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {passwordMessage && (
                <p className={styles.modalError}>{passwordMessage}</p>
              )}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={passwordSubmitting}
                >
                  {passwordSubmitting ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Account Modal (placeholder) */}
      {googleModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setGoogleModalOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Link Google Account</h3>
              <button
                className={styles.modalClose}
                onClick={() => setGoogleModalOpen(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            <div style={{ padding: "16px 0", textAlign: "center" }}>
              <p>
                This feature will allow you to connect your Google account for
                SSO.
              </p>
              <p
                style={{ fontSize: "14px", color: "#6b7280", marginTop: "8px" }}
              >
                (Backend integration needed)
              </p>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.saveBtn}
                onClick={() => setGoogleModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
