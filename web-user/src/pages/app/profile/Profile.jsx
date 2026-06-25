import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../api/client";
import {
  FiUser,
  FiMail,
  FiShield,
  FiMapPin,
  FiBriefcase,
} from "react-icons/fi";
import styles from "./Profile.module.css";

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await apiClient.get("/auth/me");
        if (data.ok) {
          setProfile(data.user);
        } else {
          setError("Failed to load profile.");
        }
      } catch (err) {
        setError("Unable to load profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

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
      <div className={styles.card}>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatar}>
            <FiUser size={40} />
          </div>
        </div>

        <h2 className={styles.email}>{displayUser.email}</h2>
        <div className={styles.badge}>{displayUser.status}</div>

        <div className={styles.details}>
          <div className={styles.row}>
            <FiUser className={styles.icon} />
            <span className={styles.label}>Name</span>
            <span className={styles.value}>{displayUser.full_name || "—"}</span>
          </div>
          <div className={styles.row}>
            <FiBriefcase className={styles.icon} />
            <span className={styles.label}>Role</span>
            <span className={styles.value}>{displayUser.role || "—"}</span>
          </div>
          <div className={styles.row}>
            <FiMapPin className={styles.icon} />
            <span className={styles.label}>Department</span>
            <span className={styles.value}>
              {displayUser.department || "—"}
            </span>
          </div>
          <div className={styles.row}>
            <FiMapPin className={styles.icon} />
            <span className={styles.label}>Office</span>
            <span className={styles.value}>{displayUser.office || "—"}</span>
          </div>
          <div className={styles.row}>
            <FiShield className={styles.icon} />
            <span className={styles.label}>Status</span>
            <span className={styles.value}>{displayUser.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
