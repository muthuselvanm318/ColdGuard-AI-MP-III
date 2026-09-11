import { api } from './client';

export async function getDevices() {
  const response = await api.get('/api/devices');
  return response.data || [];
}

export async function getDeviceById(id) {
  const response = await api.get(`/api/devices/${id}`);
  return response.data;
}

export async function createDevice(deviceData) {
  return await api.post('/api/devices', deviceData);
}

export async function updateDevice(id, deviceData) {
  return await api.put(`/api/devices/${id}`, deviceData);
}

export async function deleteDevice(id) {
  return await api.delete(`/api/devices/${id}`);
}
