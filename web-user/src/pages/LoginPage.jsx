import BrandHeader from "../components/common/BrandHeader.jsx";
import LoginForm from "../components/auth/LoginForm.jsx";
import Footer from "../components/layout/Footer.jsx";
import styles from "../styles/pages/LoginPage.module.css";

export default function LoginPage() {
  return (
    <div className={styles.loginPage}>
      <div className={styles.pageContent}>
        <BrandHeader />
        <div className={styles.loginCard}>
          <LoginForm />
        </div>
      </div>
      <Footer />
    </div>
  );
}