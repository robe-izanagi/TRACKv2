import { useState, useRef } from 'react';
import styles from './EventColor.module.css';

const PRESET_COLORS = [
  { name: 'Grey', value: '#808080' },
  { name: 'Red', value: '#800000' },
  { name: 'Yellow', value: '#F5C542' },
  { name: 'Blue', value: '#0A66B9' },
];

export default function EventColor({ value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  const handlePresetClick = (colorValue) => {
    onChange(colorValue);
    setShowPicker(false);
  };

  const handlePickerChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.label}>EVENT COLOR</div>
      <div className={styles.swatchGroup}>
        {PRESET_COLORS.map((color) => (
          <button
            key={color.name}
            type="button"
            className={`${styles.swatch} ${value === color.value ? styles.selected : ''}`}
            style={{ backgroundColor: color.value }}
            onClick={() => handlePresetClick(color.value)}
            title={color.name}
          >
            {value === color.value && <span className={styles.checkmark}>✓</span>}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.swatch} ${styles.customBtn}`}
          onClick={() => setShowPicker(!showPicker)}
          title="Custom color"
        >
          🎨
        </button>
      </div>
      {showPicker && (
        <input
          ref={pickerRef}
          type="color"
          className={styles.colorPicker}
          value={value || '#800000'}
          onChange={handlePickerChange}
        />
      )}
    </div>
  );
}