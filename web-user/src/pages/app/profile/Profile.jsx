import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../api/client";
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
  const [googleModalOpen, setGoogleModalOpen] = useState(false);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editMessage, setEditMessage] = useState("");

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

  // ─── Edit Profile ───
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

  // ─── Upload Profile Picture ───
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

  // ─── Link Google Account (same as login flow) ───
  const handleLinkGoogle = async () => {
    setGoogleModalOpen(false);
    try {
      const { data } = await apiClient.get("/auth/google");
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to get Google auth URL.");
      }
    } catch (err) {
      console.error("Google link error:", err);
      alert("Unable to connect to Google. Please try again.");
    }
  };

  // ─── Logout ───
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
            <span className={styles.settingsLabel}>Change Google Account</span>
            <span className={styles.settingsDesc}>
              Needed to change Google account
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

      {/* ─── Google Account Modal ─── */}
      {googleModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setGoogleModalOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Change Google Account</h3>
              <button
                className={styles.modalClose}
                onClick={() => setGoogleModalOpen(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            <div className={styles.googleModalContent}>
              <FiLink size={48} className={styles.googleModalIcon} />
              <p className={styles.googleModalTitle}>
                Update your Google account
              </p>
              <p className={styles.googleModalDesc}>
                We recommend to not change your Google account frequently. Only
                update your Google account if necessary. You'll be redirected to
                Google to authorize the connection.
              </p>
              <div className={styles.googleModalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setGoogleModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.googleLinkBtn}
                  onClick={handleLinkGoogle}
                >
                  <FiLink size={18} />
                  Continue to Google
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
