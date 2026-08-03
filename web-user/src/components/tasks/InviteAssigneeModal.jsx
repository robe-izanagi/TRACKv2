import InvitationModal from "./InvitationModal";

export default function InviteAssigneeModal({
  isOpen,
  onClose,
  selectedIds = [],
  onSave,
}) {
  return (
    <InvitationModal
      isOpen={isOpen}
      onClose={onClose}
      selectedIds={selectedIds}
      onSave={onSave}
      title="Add Assignees"
      type="assignees"
    />
  );
}
