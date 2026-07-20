import styles from "./BrandHeader.module.css";
import logoImageSrc from "../../assets/pup_logo.png";

export default function BrandHeader({
  campusBadge = "PUP STO TOMAS CAMPUS",
  trackTitle = "TRACK",
  tagline = (
    <>
      Timetable & Resource Allocation<br />Calendar Kit
    </>
  ),
  showLogoImage = true,
  logoAlt = "PUP Logo",
  className = "",
}) {
  return (
    <div className={`${styles.brandHeader} ${className}`}>
      {showLogoImage && (
        <img src={logoImageSrc} alt={logoAlt} className={styles.logoImage} />
      )}
      <div className={styles.campusBadge}>{campusBadge}</div>
      <div className={styles.logoSection}>
        <h1 className={styles.trackLogo}>{trackTitle}</h1>
        <p className={styles.tagline}>{tagline}</p>
      </div>
    </div>
  );
}