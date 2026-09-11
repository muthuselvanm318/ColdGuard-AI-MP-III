import React, { useState, useEffect } from 'react';
import SafetyBadge from '../components/SafetyBadge';
import AddProductModal from '../components/AddProductModal';
import EditProductModal from '../components/EditProductModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { getProducts, deleteProduct } from '../api/productsApi';
import { useToast } from '../context/ToastContext';
import { Package, Plus, Search, Eye, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Products() {
  const { addToast } = useToast();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data = await getProducts();
      setProducts(data || []);
      setError(null);
    } catch (err) {
      setError("Unable to load products. Please try again.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(() => {
      fetchProducts(false);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async () => {
    if (!deletingProduct) return;
    await deleteProduct(deletingProduct.milk_id);
    addToast("Product deleted successfully.", "success");
    setDeletingProduct(null);
    await fetchProducts(false);
  };

  const filteredProducts = products.filter(p => 
    p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.milk_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.device_id && p.device_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="page-container">

      <div className="page-header flex-between">
        <div>
          <h2 className="page-title">Milk Products Inventory</h2>
          <p className="page-subtitle">Monitored refrigerated pasteurized milk batches</p>
        </div>
        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} /> Add Product
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card table-toolbar mb-6">
        <div className="search-box flex-1">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by product name, milk ID, or sensor ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="glass-card section-card">
        {error ? (
          <div className="empty-state p-6 text-center text-danger">
            <AlertTriangle size={32} className="mx-auto mb-2" />
            <p>{error}</p>
            <button className="btn-secondary mt-4" onClick={fetchProducts}>Retry</button>
          </div>
        ) : loading && products.length === 0 ? (
          <div className="empty-state p-6 text-center">
            <div className="spinner mb-4"></div>
            <p>Loading products...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Milk ID</th>
                  <th>Product Name</th>
                  <th>Milk Type</th>
                  <th>Storage Start</th>
                  <th>Assigned Sensor</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-6 text-muted">
                      {products.length === 0 ? "No milk products found. Add your first milk product to begin monitoring." : "No products found matching search criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.milk_id}</strong></td>
                      <td><strong>{p.product_name}</strong></td>
                      <td>{p.milk_type}</td>
                      <td>{new Date(p.storage_start_time).toLocaleString()}</td>
                      <td>{p.device_id || 'Unassigned'}</td>
                      <td><SafetyBadge status={p.status} /></td>
                      <td>
                        <div className="action-buttons-group">
                          <Link to={`/products/${p.milk_id}`} className="btn-icon-action" title="View Details">
                            <Eye size={16} />
                          </Link>
                          <button className="btn-icon-action text-primary" title="Edit Product" onClick={() => setEditingProduct(p)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="btn-icon-action text-danger" title="Delete Product" onClick={() => setDeletingProduct(p)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <AddProductModal 
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={() => {
            setIsAddModalOpen(false);
            addToast("Product added successfully.", "success");
            fetchProducts(false);
          }}
        />
      )}

      {editingProduct && (
        <EditProductModal 
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            addToast("Product updated successfully.", "success");
            fetchProducts(false);
          }}
        />
      )}

      {deletingProduct && (
        <DeleteConfirmModal
          title="Delete Product?"
          message={`Are you sure you want to delete ${deletingProduct.product_name}? This will remove all associated temperature history and predictions.`}
          onClose={() => setDeletingProduct(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
