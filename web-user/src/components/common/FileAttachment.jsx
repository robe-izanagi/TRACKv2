import styles from "./FileAttachment.module.css";

export default function FileAttachment({ files = [], onRemove, onAdd }) {
  const hasFiles = files.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>ATTACHMENTS (OPTIONAL)</div>

      {!hasFiles ? (
        /* No files yet: show full‑width button */
        <button className={styles.addButton} onClick={onAdd}>
          + Add File
        </button>
      ) : (
        /* Files present: file list on the left, button on the right */
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <div className={styles.fileList} style={{ flex: 1 }}>
            {files.map((file) => (
              <div
                key={file.name}
                className={styles.fileItem}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span>{file.name}</span>
                  {file.size && (
                    <span className={styles.fileSize}> {file.size}</span>
                  )}
                </div>
                <button onClick={() => onRemove(file)}>🗑️</button>
              </div>
            ))}
          </div>
          <button
            className={styles.addButton}
            style={{ width: "auto", padding: "0.6rem 1.2rem", flexShrink: 0 }}
            onClick={onAdd}
          >
            + Add File
          </button>
        </div>
      )}
    </div>
  );
}
