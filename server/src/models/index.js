const sequelize = require('../config/database');

// Lookups
const Department = require('./departments');
const Office = require('./offices');
const Role = require('./roles');
const Position = require('./positions');     
const PositionAssignment = require('./position_assignments'); 

// Core
const User = require('./users');
const Admin = require('./admins');
const AccountCode = require('./account_codes');
const UserProfile = require('./user_profile');
const UserBlock = require('./user_blocks');
const UserSession = require('./user_sessions');
const UserAuthIdentity = require('./user_auth_identities');
const AllowedDomain = require('./allowed_domain');

// Logs & Metrics
const LoginAttempt = require('./login_attempts');
const AuditLog = require('./audit_logs');
const DailyMetric = require('./daily_metrics');

// Requests
const AccountCodeRequest = require('./account_code_requests');

// User side
const Venue = require('./venues');
const Event = require('./events');
const EventAttendee = require('./event_attendees');
const EventCollaborator = require('./event_collaborators');
const Task = require('./tasks');
const TaskChecklistItem = require('./task_checklist_items');
const TaskCollaborator = require('./task_collaborators');
const Attachment = require('./attachments');

// Feedback & Notifications
const FeedbackRating = require('./feedback_ratings');
const FeedbackKeyword = require('./feedback_keywords');
const Notification = require('./notifications');
const EmailQueue = require('./email_queue');

// =====================
// ASSOCIATIONS
// =====================

// --- account_codes ---
AccountCode.belongsTo(Department, { foreignKey: 'department_id', onDelete: 'SET NULL' });
AccountCode.belongsTo(Office, { foreignKey: 'office_id' });
AccountCode.belongsTo(Role, { foreignKey: 'role_id' });
AccountCode.belongsTo(Admin, { foreignKey: 'generated_by_admin_id', onDelete: 'SET NULL' });
AccountCode.belongsTo(User, { foreignKey: 'used_by_user_id', onDelete: 'SET NULL' });
AccountCode.belongsTo(Position, { foreignKey: 'position_id', onDelete: 'SET NULL' });   // NEW

// --- users ---
User.belongsTo(AccountCode, { foreignKey: 'account_code_id', onDelete: 'SET NULL' });
User.hasOne(UserProfile, { foreignKey: 'user_id' });

// --- admins ---
Admin.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });

// --- user_profile ---
UserProfile.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
UserProfile.belongsTo(Department, { foreignKey: 'department_id', onDelete: 'SET NULL' });
UserProfile.belongsTo(Office, { foreignKey: 'office_id', onDelete: 'SET NULL' });
UserProfile.belongsTo(Role, { foreignKey: 'role_id', onDelete: 'SET NULL' });
UserProfile.belongsTo(Position, { foreignKey: 'position_id', onDelete: 'SET NULL' });   // NEW

// --- user_blocks ---
UserBlock.belongsTo(User, { foreignKey: 'target_user_id', onDelete: 'CASCADE' });
UserBlock.belongsTo(Admin, { foreignKey: 'blocked_by_admin_id' });

// --- user_sessions ---
UserSession.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });

// --- user_auth_identities ---
UserAuthIdentity.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });

// --- login_attempts ---
LoginAttempt.belongsTo(User, { foreignKey: 'user_id', onDelete: 'SET NULL' });

// --- audit_logs ---
AuditLog.belongsTo(Admin, { foreignKey: 'actor_admin_id', onDelete: 'SET NULL' });
AuditLog.belongsTo(User, { foreignKey: 'target_user_id', onDelete: 'SET NULL' });

// --- account_code_requests ---
AccountCodeRequest.belongsTo(Department, { foreignKey: 'department_id', onDelete: 'SET NULL' });
AccountCodeRequest.belongsTo(Office, { foreignKey: 'office_id', onDelete: 'SET NULL' });
AccountCodeRequest.belongsTo(Role, { foreignKey: 'role_id', onDelete: 'SET NULL' });
AccountCodeRequest.belongsTo(Admin, { foreignKey: 'reviewed_by_admin_id', onDelete: 'SET NULL' });

// --- venues ---
Venue.belongsTo(User, { foreignKey: 'created_by' });

// --- events ---
Event.belongsTo(Venue, { foreignKey: 'venue_id', onDelete: 'SET NULL' });
Event.belongsTo(Department, { foreignKey: 'department_id', onDelete: 'SET NULL' });
Event.belongsTo(Office, { foreignKey: 'office_id', onDelete: 'SET NULL' });
Event.belongsTo(User, { foreignKey: 'creator_id' });

// --- event_attendees ---
EventAttendee.belongsTo(Event, { foreignKey: 'event_id', onDelete: 'CASCADE' });
EventAttendee.belongsTo(User, { foreignKey: 'user_id' });

// --- event_collaborators ---
EventCollaborator.belongsTo(Event, { foreignKey: 'event_id', onDelete: 'CASCADE' });
EventCollaborator.belongsTo(User, { foreignKey: 'user_id' });

// --- tasks ---
Task.belongsTo(Department, { foreignKey: 'department_id', onDelete: 'SET NULL' });
Task.belongsTo(Office, { foreignKey: 'office_id', onDelete: 'SET NULL' });
Task.belongsTo(User, { foreignKey: 'creator_id' });
Task.belongsTo(User, { foreignKey: 'assignee_id', onDelete: 'SET NULL' });

// --- task_checklist_items ---
TaskChecklistItem.belongsTo(Task, { foreignKey: 'task_id', onDelete: 'CASCADE' });

// --- task_collaborators ---
TaskCollaborator.belongsTo(Task, { foreignKey: 'task_id', onDelete: 'CASCADE' });
TaskCollaborator.belongsTo(User, { foreignKey: 'user_id' });

// --- feedback_ratings ---
FeedbackRating.belongsTo(User, { foreignKey: 'user_id' });

// --- notifications ---
Notification.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });

// --- positions (NEW) ---
Position.hasMany(PositionAssignment, { foreignKey: 'position_id' });
PositionAssignment.belongsTo(Position, { foreignKey: 'position_id' });
PositionAssignment.belongsTo(User, { foreignKey: 'user_id' });

// =====================
// EXPORTS
// =====================
module.exports = {
  sequelize,
  Department,
  Office,
  Role,
  Position,      
  PositionAssignment,    
  User,
  Admin,
  AccountCode,
  UserProfile,
  UserBlock,
  UserSession,
  UserAuthIdentity,
  AllowedDomain,
  LoginAttempt,
  AuditLog,
  DailyMetric,
  AccountCodeRequest,
  Venue,
  Event,
  EventAttendee,
  EventCollaborator,
  Task,
  TaskChecklistItem,
  TaskCollaborator,
  Attachment,
  FeedbackRating,
  FeedbackKeyword,
  Notification,
  EmailQueue
};