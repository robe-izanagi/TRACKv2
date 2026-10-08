const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  toggleChecklistItem,
  addChecklistComment,
  respondToTask,
  getInvitedTasks,
  deleteTask, listArchivedTasks, archiveTask
} = require('../controllers/tasksController');

router.get('/', authenticate, listTasks);
router.get('/archived', authenticate, listArchivedTasks);
router.patch('/:id/archive', authenticate, archiveTask);
router.post('/', authenticate, createTask);
router.get('/invited', authenticate, getInvitedTasks);
router.get('/:id', authenticate, getTaskById);
router.put('/:id', authenticate, updateTask);
router.delete('/:id', authenticate, deleteTask);
router.put('/:taskId/respond', authenticate, respondToTask);
router.put('/checklist/:itemId', authenticate, toggleChecklistItem);
router.post('/checklist/:itemId/comments', authenticate, addChecklistComment);

module.exports = router;