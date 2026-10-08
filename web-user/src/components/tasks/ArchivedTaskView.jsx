import { FiArchive, FiCalendar, FiCheck, FiClock, FiUsers } from "react-icons/fi";
import Modal from "../common/Modal";
import taskStyles from "./TaskCardView.module.css";
import styles from "./ArchivedTaskView.module.css";
import { getReadableTextColor } from "../../utils/colorUtils";

const responseLabel = (response) => {
  if (response === "accepted") return "Accepted";
  if (response === "declined") return "Declined";
  return "Pending";
};

export default function ArchivedTaskView({ task, onClose, onUseTemplate }) {
  if (!task) return null;
  const headerTextColor = getReadableTextColor(task.color);

  const groupedChecklist = (task.checklist_items || []).reduce((groups, item) => {
    const key = item.card_id || "default";
    let group = groups.find((entry) => entry.id === key);
    if (!group) {
      group = { id: key, title: item.card_title || "Checklist", items: [] };
      groups.push(group);
    }
    group.items.push(item);
    return groups;
  }, []);

  return (
    <Modal isOpen={!!task} onClose={onClose} title={task.title}>
      <div className={styles.content}>
        <div
          className={taskStyles.header}
          style={{ backgroundColor: task.color || "#3B82F6", color: headerTextColor }}
        >
          <div className={taskStyles.metaBadges}>
            <span
              className={taskStyles.priorityBadge}
              style={{ color: headerTextColor, borderColor: headerTextColor }}
            >
              {task.priority} priority
            </span>
            <span
              className={taskStyles.visibilityBadge}
              style={{ color: headerTextColor, borderColor: headerTextColor }}
            >
              {task.visibility}
            </span>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.archiveNotice}>
            <FiArchive size={16} />
            <span>This task is archived. Its deadline date, collaborators, and attachments are not available.</span>
          </div>

          <div className={taskStyles.details}>
            <div className={taskStyles.detailRow}>
              <FiCalendar size={16} />
              <span>Deadline date not retained</span>
            </div>
            <div className={taskStyles.detailRow}>
              <FiClock size={16} />
              <span>Deadline time: {task.deadline_time || "Not set"}</span>
            </div>
          </div>

          <p className={styles.description}>
            {task.description || "No description provided."}
          </p>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <FiUsers size={16} /> Assigned users
              <span className={styles.count}>{task.assignees?.length || 0}</span>
            </h3>
            {task.assignees?.length ? (
              <ul className={styles.assigneeList}>
                {task.assignees.map((assignee) => (
                  <li className={styles.assignee} key={assignee.id}>
                    <span className={styles.assigneeName}>{assignee.full_name}</span>
                    <span className={`${styles.response} ${styles[assignee.response || "pending"]}`}>
                      {responseLabel(assignee.response)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyText}>No assigned users.</p>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Checklist</h3>
            {groupedChecklist.length ? (
              <div className={styles.checklists}>
                {groupedChecklist.map((group) => (
                  <div className={styles.checklistGroup} key={group.id}>
                    {groupedChecklist.length > 1 && (
                      <h4 className={styles.checklistTitle}>{group.title}</h4>
                    )}
                    <ul className={styles.checklist}>
                      {group.items.map((item, index) => (
                        <li className={styles.checklistItem} key={`${group.id}-${index}`}>
                          <span className={styles.checkbox}><FiCheck size={13} /></span>
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyText}>No checklist items.</p>
            )}
          </section>

          <div className={styles.actions}>
            <button type="button" className={styles.templateButton} onClick={onUseTemplate}>
              Use as template
            </button>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
