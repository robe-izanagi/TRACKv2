import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerLogo}>TRACK</div>
      <div className={styles.footerLinks}>
        <a href="/privacy-policy">Privacy Policy</a>
        <a href="/terms-and-conditions">Terms of Service</a>
      </div>
      <div className={styles.copyright}>© 2026 TRACK. All rights reserved.</div>
    </footer>
  );
}
