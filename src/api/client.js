/**
 * ColdGuard AI REST API Client
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function handleResponse(response) {
  if (!response.ok) {
    let errorMsg = `HTTP error! status: ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) errorMsg = errData.detail;
    } catch (e) {
      // Ignore JSON parse errors for non-JSON error responses
    }
    throw new Error(errorMsg);
  }
  return await response.json();
}

export const api = {
  async get(endpoint) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      return await handleResponse(response);
    } catch (error) {
      console.error(`[API GET Error] ${endpoint}:`, error);
      throw error;
    }
  },

  async post(endpoint, data) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error(`[API POST Error] ${endpoint}:`, error);
      throw error;
    }
  },

  async put(endpoint, data) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error(`[API PUT Error] ${endpoint}:`, error);
      throw error;
    }
  },

  async delete(endpoint) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE'
      });
      return await handleResponse(response);
    } catch (error) {
      console.error(`[API DELETE Error] ${endpoint}:`, error);
      throw error;
    }
  }
};
