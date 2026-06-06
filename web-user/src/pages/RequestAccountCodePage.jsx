import BrandHeader from "../components/common/BrandHeader.jsx";
import RequestAccountCodeForm from "../components/auth/RequestAccountCodeForm.jsx";
import Footer from "../components/layout/Footer.jsx";
import styles from "../styles/pages/RequestAccountCodePage.module.css";

export default function RequestAccountCodePage() {
  return (
    <div className={styles.requestAccountCodePage}>
      <div className={styles.pageContent}>
        <BrandHeader />
        <div className={styles.requestCard}>
          <RequestAccountCodeForm />
        </div>
      </div>
      <Footer />
    </div>
  );
}
