import { useState, useRef } from 'react';
import styles from './TaskColor.module.css';

const PRESET_COLORS = [
  { name: 'Grey', value: '#808080' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#7C3AED' },
];

export default function TaskColor({ value, onChange }) {
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
      <div className={styles.label}>TASK COLOR</div>
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
          value={value || PRESET_COLORS[0].value}
          onChange={handlePickerChange}
        />
      )}
    </div>
  );
}
