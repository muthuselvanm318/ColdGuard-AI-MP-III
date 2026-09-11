import { api } from './client';

export async function getProducts() {
  const response = await api.get('/api/products');
  return response.data || [];
}

export async function getProductById(id) {
  const response = await api.get(`/api/products/${id}`);
  return response.data;
}

export async function createProduct(productData) {
  return await api.post('/api/products', productData);
}

export async function updateProduct(id, productData) {
  return await api.put(`/api/products/${id}`, productData);
}

export async function deleteProduct(id) {
  return await api.delete(`/api/products/${id}`);
}
