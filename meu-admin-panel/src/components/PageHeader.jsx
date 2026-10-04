import { useTranslation } from 'react-i18next';
import meuLogo from '../assets/meu-logo.png';

// Lives in its own module so pages don't import from App.jsx
export default function PageHeader({ title, actions }) {
  const { i18n } = useTranslation();
  const rtl = i18n.language?.startsWith('ar');
  return (
    <header className="top-bar">
      <h1>{title}</h1>
      <div className="top-bar__actions">
        {actions}
        <div className="lang-toggle" role="group" aria-label="Language">
          <button onClick={() => i18n.changeLanguage('en')} aria-pressed={!rtl}>EN</button>
          <button onClick={() => i18n.changeLanguage('ar')} aria-pressed={rtl}>ع</button>
        </div>
        <img 
          src={meuLogo} 
          alt="Middle East University Logo" 
          style={{ height: '38px', borderRadius: '4px', objectFit: 'contain' }} 
        />
      </div>
    </header>
  );
}

