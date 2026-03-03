import axios from 'axios';

const CLICKUP_API_URL = 'https://api.clickup.com/api/v2';

let accessToken = null;

export const clickupClient = {
  setAccessToken(token) {
    accessToken = token;
  },

  getAccessToken() {
    return accessToken;
  },

  async exchangeCodeForToken(code) {
    try {
      const params = new URLSearchParams();
      params.append('client_id', process.env.CLICKUP_CLIENT_ID);
      params.append('client_secret', process.env.CLICKUP_CLIENT_SECRET);
      params.append('code', code);

      const response = await axios.post('https://api.clickup.com/api/v2/oauth/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      accessToken = response.data.access_token;
      console.log('✅ ClickUp access token obtained successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Error exchanging code for token:', error.response?.data || error.message);
      console.error('Response status:', error.response?.status);
      console.error('Response headers:', error.response?.headers);
      throw error;
    }
  },

  async getAuthorizedWorkspaces() {
    try {
      const response = await axios.get(`${CLICKUP_API_URL}/team`, {
        headers: {
          'Authorization': accessToken,
          'Content-Type': 'application/json'
        }
      });
      return response.data.teams;
    } catch (error) {
      console.error('❌ Error getting workspaces:', error.response?.data || error.message);
      throw error;
    }
  },

  async getListTasks(listId) {
    try {
      const response = await axios.get(
        `${CLICKUP_API_URL}/list/${listId}/task`,
        {
          headers: {
            'Authorization': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.tasks;
    } catch (error) {
      console.error('❌ Error getting list tasks:', error.response?.data || error.message);
      throw error;
    }
  },

  async getTask(taskId) {
    try {
      const response = await axios.get(
        `${CLICKUP_API_URL}/task/${taskId}`,
        {
          headers: {
            'Authorization': accessToken
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ Error getting task:', error.response?.data || error.message);
      throw error;
    }
  },

  async createTaskComment(taskId, comment) {
    try {
      const response = await axios.post(
        `${CLICKUP_API_URL}/task/${taskId}/comment`,
        { comment_text: comment },
        {
          headers: {
            'Authorization': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ Error creating comment:', error.response?.data || error.message);
      throw error;
    }
  },

  async updateTaskStatus(taskId, status) {
    try {
      const response = await axios.put(
        `${CLICKUP_API_URL}/task/${taskId}`,
        { status: status },
        {
          headers: {
            'Authorization': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ Error updating task status:', error.response?.data || error.message);
      throw error;
    }
  },

  async getSpaces(workspaceId) {
    try {
      const response = await axios.get(
        `${CLICKUP_API_URL}/team/${workspaceId}/space`,
        {
          headers: {
            'Authorization': accessToken
          }
        }
      );
      return response.data.spaces;
    } catch (error) {
      console.error('❌ Error getting spaces:', error.response?.data || error.message);
      throw error;
    }
  },

  async getLists(folderId) {
    try {
      const response = await axios.get(
        `${CLICKUP_API_URL}/folder/${folderId}/list`,
        {
          headers: {
            'Authorization': accessToken
          }
        }
      );
      return response.data.lists;
    } catch (error) {
      console.error('❌ Error getting lists:', error.response?.data || error.message);
      throw error;
    }
  }
};
