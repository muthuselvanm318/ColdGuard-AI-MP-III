import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useData } from '../context/DataContext';
import ProductCard from '../components/ProductCard';
import AddProductModal from '../components/AddProductModal';

const Products = () => {
  const { products } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Product Inventory</h1>
          <p className="page-subtitle">Track food safety status in real-time</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>Register Product</span>
        </button>
      </div>

      <div className="filter-bar mb-lg">
        <span className="filter-chip filter-chip--active">All ({products.length})</span>
        <span className="filter-chip text-safe" style={{ borderColor: 'var(--safe-border)' }}>Safe</span>
        <span className="filter-chip text-caution" style={{ borderColor: 'var(--caution-border)' }}>Caution</span>
        <span className="filter-chip text-danger" style={{ borderColor: 'var(--danger-border)' }}>Unsafe</span>
      </div>

      <div className="grid-auto stagger-children">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      
      <AddProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default Products;
