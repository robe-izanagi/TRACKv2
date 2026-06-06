import BrandHeader from "../components/common/BrandHeader.jsx";
import RegisterForm from "../components/auth/RegisterForm.jsx";
import Footer from "../components/layout/Footer.jsx";
import styles from "../styles/pages/RegisterPage.module.css";

export default function RegisterPage() {
  return (
    <div className={styles.registerPage}>
      <div className={styles.pageContent}>
        <BrandHeader />
        <div className={styles.registerCard}>
          <RegisterForm />
        </div>
      </div>
      <Footer />
    </div>
  );
}
