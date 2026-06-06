import styles from "../../styles/components/common/BrandHeader.module.css";

export default function BrandHeader({
  campusBadge = "PUP STO TOMAS CAMPUS",
  trackTitle = "TRACK",
  tagline = (
    <>
      Timetable & Resource Allocation<br />Calendar Kit
    </>
  ),
  showLogoImage = true,
  logoImageSrc = "src/assets/pup_logo.png",
  logoAlt = "PUP Logo",
  className = "",
  sectionHeading="",
}) {
  return (
    <div className={`${styles.brandHeader} ${className}`}>
      {showLogoImage && logoImageSrc && (
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
