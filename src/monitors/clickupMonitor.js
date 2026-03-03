import { clickupClient } from '../integrations/clickupClient.js';
import { config } from '../config/slack.js';
import cron from 'node-cron';
import db from '../database/db.js';

let slackClient = null;
let monitorJob = null;
let lastCheckedTasks = new Map();
let configuredListId = null;

export const clickupMonitor = {
  initialize(client) {
    slackClient = client;
    this.loadConfiguration();
    this.scheduleMonitoring();
  },

  loadConfiguration() {
    // Load configured list ID from environment or database
    configuredListId = process.env.CLICKUP_LIST_ID;
    console.log(`📋 ClickUp monitor initialized${configuredListId ? ` for list: ${configuredListId}` : ' (no list configured yet)'}`);
  },

  setListId(listId) {
    configuredListId = listId;
    console.log(`📋 ClickUp list configured: ${listId}`);
  },

  getListId() {
    return configuredListId;
  },

  scheduleMonitoring() {
    // Check every 5 minutes for task updates
    monitorJob = cron.schedule('*/5 * * * *', async () => {
      if (configuredListId && clickupClient.getAccessToken()) {
        await this.checkTaskUpdates();
      }
    });
    
    console.log('📋 ClickUp task monitoring scheduled (every 5 minutes)');
  },

  async checkTaskUpdates() {
    try {
      if (!configuredListId) {
        console.log('⏭️  No ClickUp list configured, skipping monitoring');
        return;
      }

      const tasks = await clickupClient.getListTasks(configuredListId);
      console.log(`📋 Checking ${tasks.length} tasks from ClickUp list ${configuredListId}`);

      const now = Date.now();

      for (const task of tasks) {
        const lastState = lastCheckedTasks.get(task.id);
        
        // Check if task is overdue
        const isOverdue = task.due_date && parseInt(task.due_date) < now;
        const isComplete = task.status.status.toLowerCase().includes('complete') || 
                          task.status.status.toLowerCase().includes('done') ||
                          task.status.status.toLowerCase().includes('closed');
        
        // Only notify about overdue tasks that are not complete
        if (isOverdue && !isComplete) {
          // Check if we've already notified about this task being overdue
          const wasNotified = lastState?.overdueNotified;
          
          if (!wasNotified) {
            await this.notifyOverdueTask(task);
            
            // Mark as notified
            lastCheckedTasks.set(task.id, {
              status: task.status.status,
              assignees: task.assignees.map(a => a.id),
              overdueNotified: true
            });
          }
        } else {
          // Update state without overdue flag if not overdue
          lastCheckedTasks.set(task.id, {
            status: task.status.status,
            assignees: task.assignees.map(a => a.id),
            overdueNotified: false
          });
        }
      }
    } catch (error) {
      console.error('❌ Error checking ClickUp tasks:', error.message);
    }
  },

  assigneesChanged(oldAssignees, newAssignees) {
    const oldIds = oldAssignees || [];
    const newIds = newAssignees.map(a => a.id);
    
    if (oldIds.length !== newIds.length) return true;
    
    return !oldIds.every(id => newIds.includes(id));
  },

  async notifyOverdueTask(task) {
    const dueDate = new Date(parseInt(task.due_date));
    const dueDateStr = dueDate.toLocaleDateString();
    const daysOverdue = Math.floor((Date.now() - parseInt(task.due_date)) / (1000 * 60 * 60 * 24));
    
    // Map ClickUp usernames to Slack user mentions
    const slackMentions = this.getSlackMentions(task.assignees);
    const assigneeText = slackMentions.length > 0 ? slackMentions.join(', ') : 'Unassigned';
    
    const message = `⚠️ *Overdue Task Alert*\n\n*${task.name}*\n• Assigned to: ${assigneeText}\n• Due date: ${dueDateStr} (${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue)\n• Status: ${task.status.status}\n• Priority: ${task.priority?.priority || 'None'}\n\n${slackMentions.length > 0 ? slackMentions.join(' ') + ' - ' : ''}Please update the due date or add a comment with your progress.\n\n<${task.url}|View in ClickUp>`;

    await slackClient.chat.postMessage({
      channel: config.target.channelId,
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message
          }
        }
      ]
    });

    console.log(`✅ Notified overdue task: ${task.name} (${daysOverdue} days overdue)`);
  },

  getSlackMentions(assignees) {
    // Map ClickUp usernames to Slack user IDs
    // You can customize this mapping based on your team
    const userMapping = {
      // Add team member mappings here
      // Example: 'ClickUp Username': 'SLACK_USER_ID',
    };

    const mentions = [];
    for (const assignee of assignees) {
      const slackUserId = userMapping[assignee.username] || userMapping[assignee.username.toLowerCase()];
      if (slackUserId) {
        mentions.push(`<@${slackUserId}>`);
      }
    }
    
    return mentions;
  },

  async notifyStatusChange(task, oldStatus) {
    const assigneeNames = task.assignees.map(a => a.username).join(', ') || 'Unassigned';
    
    const statusEmoji = this.getStatusEmoji(task.status.status);
    const message = `${statusEmoji} *Task Status Updated*\n\n*${task.name}*\n• Status: ${oldStatus} → *${task.status.status}*\n• Assigned to: ${assigneeNames}\n\n<${task.url}|View in ClickUp>`;

    await slackClient.chat.postMessage({
      channel: config.target.channelId,
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message
          }
        }
      ]
    });

    console.log(`✅ Notified status change: ${task.name} (${oldStatus} → ${task.status.status})`);
  },

  async notifyAssigneeChange(task, oldAssigneeIds) {
    const newAssignees = task.assignees.map(a => a.username).join(', ') || 'Unassigned';
    
    const message = `👤 *Task Assignment Updated*\n\n*${task.name}*\n• Now assigned to: ${newAssignees}\n• Status: ${task.status.status}\n\n<${task.url}|View in ClickUp>`;

    await slackClient.chat.postMessage({
      channel: config.target.channelId,
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message
          }
        }
      ]
    });

    console.log(`✅ Notified assignee change: ${task.name}`);
  },

  getStatusEmoji(status) {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('complete') || statusLower.includes('done')) return '✅';
    if (statusLower.includes('progress') || statusLower.includes('doing')) return '🔄';
    if (statusLower.includes('review')) return '👀';
    if (statusLower.includes('blocked')) return '🚫';
    return '📋';
  },

  async getTasksByAssignee(listId) {
    try {
      const tasks = await clickupClient.getListTasks(listId || configuredListId);
      const tasksByAssignee = {};

      for (const task of tasks) {
        for (const assignee of task.assignees) {
          if (!tasksByAssignee[assignee.username]) {
            tasksByAssignee[assignee.username] = [];
          }
          tasksByAssignee[assignee.username].push({
            name: task.name,
            status: task.status.status,
            url: task.url,
            dueDate: task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : null
          });
        }
      }

      return tasksByAssignee;
    } catch (error) {
      console.error('❌ Error getting tasks by assignee:', error.message);
      throw error;
    }
  },

  stop() {
    if (monitorJob) {
      monitorJob.stop();
      console.log('🛑 ClickUp monitor stopped');
    }
  }
};
