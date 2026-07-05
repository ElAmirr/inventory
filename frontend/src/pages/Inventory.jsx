import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Plus, Edit, Trash2, AlertTriangle, ArrowUpDown, Info, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import './Inventory.css';

export default function Inventory() {
    const { token, user } = useContext(AuthContext);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);

    // Modals state
    const [isProductModalOpen, setProductModalOpen] = useState(false);
    const [isStockModalOpen, setStockModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    // Form states
    const [formData, setFormData] = useState({
        name: '', sku: '', barcode: '', category: '',
        cost_price: 0, selling_price: 0, stock_quantity: 0, reorder_threshold: 0
    });

    const [stockFormData, setStockFormData] = useState({ change_qty: 0, reason: 'manual_adjustment' });

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const res = await fetch('http://localhost:3001/api/products', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setProducts(data);
            } else {
                toast.error(data.error);
            }
        } catch (e) {
            toast.error('Échec du chargement des produits');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/admin/categories', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setCategories(await res.json());
            }
        } catch (e) {
            console.error('Échec du chargement des catégories');
        }
    };

    useEffect(() => {
        fetchProducts();
        if (user?.role === 'admin') {
            fetchCategories();
        }
    }, [token, user]);

    const handleProductSubmit = async (e) => {
        e.preventDefault();
        const url = editingProduct ? `http://localhost:3001/api/products/${editingProduct.id}` : 'http://localhost:3001/api/products';
        const method = editingProduct ? 'PUT' : 'POST';

        // Convert to numbers properly
        const payload = {
            ...formData,
            cost_price: Math.round(Number(formData.cost_price) * 100), // assuming UI input is in dollars/local curr, db is cents
            selling_price: Math.round(Number(formData.selling_price) * 100),
            stock_quantity: Number(formData.stock_quantity),
            reorder_threshold: Number(formData.reorder_threshold)
        };

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(editingProduct ? 'Produit mis à jour' : 'Produit ajouté');
                setProductModalOpen(false);
                fetchProducts();
            } else {
                toast.error(data.error);
            }
        } catch (e) {
            toast.error('Erreur lors de la sauvegarde');
        }
    };

    const handleStockSubmit = async (e) => {
        e.preventDefault();
        if (!editingProduct) return;
        try {
            const res = await fetch(`http://localhost:3001/api/products/${editingProduct.id}/stock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    change_qty: Number(stockFormData.change_qty),
                    reason: stockFormData.reason
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Stock ajusté');
                setStockModalOpen(false);
                fetchProducts();
            } else {
                toast.error(data.error);
            }
        } catch (e) {
            toast.error('Erreur lors de l\'ajustement');
        }
    };

    const openNewProduct = () => {
        setEditingProduct(null);
        setFormData({ name: '', sku: '', barcode: '', category: '', cost_price: 0, selling_price: 0, stock_quantity: 0, reorder_threshold: 0 });
        setProductModalOpen(true);
    };

    const openEditProduct = (prod) => {
        setEditingProduct(prod);
        setFormData({
            name: prod.name, sku: prod.sku || '', barcode: prod.barcode || '', category: prod.category || '',
            cost_price: (prod.cost_price / 100).toFixed(2),
            selling_price: (prod.selling_price / 100).toFixed(2),
            stock_quantity: prod.stock_quantity,
            reorder_threshold: prod.reorder_threshold
        });
        setProductModalOpen(true);
    };

    const openStockModal = (prod) => {
        setEditingProduct(prod);
        setStockFormData({ change_qty: 0, reason: 'manual_adjustment' });
        setStockModalOpen(true);
    };

    return (
        <div className="inventory-page">
            <div className="page-header">
                <h1>Gestion de l'inventaire</h1>
                {user?.role === 'admin' && (
                    <button className="primary-btn" onClick={openNewProduct}>
                        <Plus size={18} /> Nouveau produit
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{
                        position: 'absolute', left: '16px', top: '50%',
                        transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none'
                    }} />
                    <input
                        type="text"
                        placeholder="Rechercher par nom, SKU, ou code-barres..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '12px 16px 12px 46px',
                            borderRadius: '24px', background: '#f8fafc',
                            border: '1px solid var(--border-color)', color: 'var(--text-main)',
                            fontSize: '0.95rem', boxSizing: 'border-box',
                            transition: 'border-color 0.2s, box-shadow 0.2s', outline: 'none'
                        }}
                        onFocus={e => { e.target.style.borderColor = '#4f46e5'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.2)'; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                    />
                </div>

                <button
                    style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: showLowStockOnly ? '#f97316' : 'var(--border-color)',
                        background: showLowStockOnly ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                        color: showLowStockOnly ? '#ea580c' : 'var(--text-muted)',
                        fontWeight: showLowStockOnly ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                    }}
                    onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                >
                    <AlertTriangle size={16} />
                    Stock Critique
                </button>
            </div>

            <div className="card">
                {loading ? <p>Chargement des produits...</p> : (
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Nom / Code-barres</th>
                                <th>Catégorie</th>
                                {user?.role === 'admin' && <th>Coût</th>}
                                <th>Prix</th>
                                <th>Stock</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products
                                .filter(p => !searchQuery ||
                                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
                                    (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())))
                                .filter(p => !showLowStockOnly || p.stock_quantity <= p.reorder_threshold)
                                .map(p => {
                                    const isLowStock = p.stock_quantity <= p.reorder_threshold;
                                    return (
                                        <tr key={p.id}>
                                            <td>
                                                <div className="product-name">{p.name}</div>
                                                <div className="product-sku">{p.barcode || p.sku || 'Sans code-barres'}</div>
                                            </td>
                                            <td>{p.category || '-'}</td>
                                            {user?.role === 'admin' && <td>{(p.cost_price / 100).toFixed(3)} DT</td>}
                                            <td>{(p.selling_price / 100).toFixed(3)} DT</td>
                                            <td>
                                                <div className={`stock-badge ${isLowStock ? 'alert' : 'ok'}`}>
                                                    {p.stock_quantity}
                                                    {isLowStock && <AlertTriangle size={14} style={{ marginLeft: 5 }} />}
                                                </div>
                                            </td>
                                            <td className="actions-cell">
                                                {user?.role === 'admin' && (
                                                    <>
                                                        <button className="icon-btn edit-btn" onClick={() => openEditProduct(p)} title="Modifier">
                                                            <Edit size={16} />
                                                        </button>
                                                        <button className="icon-btn stock-btn" onClick={() => openStockModal(p)} title="Ajuster le stock">
                                                            <ArrowUpDown size={16} /> {/* Actually ArrowUpDown is not standard in old lucide versions. Need to just use Info or similar if it throws. Let's use plus/minus or simple buttons */}
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</h2>
                        <form onSubmit={handleProductSubmit} className="grid-form">
                            <div className="form-group span-2">
                                <label>Nom du produit</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Code-barres</label>
                                <input type="text" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>SKU <span style={{ color: 'red' }}>*</span></label>
                                <input type="text" required value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="Obligatoire & unique" />
                            </div>
                            <div className="form-group span-2">
                                <label>Catégorie</label>
                                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required>
                                    <option value="">-- Choisir une catégorie --</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Prix d'achat (DT)</label>
                                <input type="number" step="0.01" min="0" required value={formData.cost_price} onChange={e => setFormData({ ...formData, cost_price: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Prix de vente (DT)</label>
                                <input type="number" step="0.01" min="0" required value={formData.selling_price} onChange={e => setFormData({ ...formData, selling_price: e.target.value })} />
                            </div>
                            {!editingProduct && (
                                <div className="form-group">
                                    <label>Stock initial</label>
                                    <input type="number" min="0" value={formData.stock_quantity} onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })} />
                                </div>
                            )}
                            <div className="form-group">
                                <label>Seuil d'alerte</label>
                                <input type="number" min="0" value={formData.reorder_threshold} onChange={e => setFormData({ ...formData, reorder_threshold: e.target.value })} />
                            </div>
                            <div className="modal-actions span-2">
                                <button type="button" className="ghost-btn" onClick={() => setProductModalOpen(false)}>Annuler</button>
                                <button type="submit" className="primary-btn">Sauvegarder</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stock Adjustment Modal */}
            {isStockModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content small-modal">
                        <h2>Ajuster le stock : {editingProduct?.name}</h2>
                        <form onSubmit={handleStockSubmit}>
                            <div className="form-group">
                                <label>Changer la quantité (Négatif pour réduire)</label>
                                <input type="number" required value={stockFormData.change_qty} onChange={e => setStockFormData({ ...stockFormData, change_qty: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Raison</label>
                                <select value={stockFormData.reason} onChange={e => setStockFormData({ ...stockFormData, reason: e.target.value })}>
                                    <option value="manual_adjustment">Ajustement manuel</option>
                                    <option value="received">Stock reçu</option>
                                    <option value="damage">Perte / Casse</option>
                                    <option value="return">Retour client</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="ghost-btn" onClick={() => setStockModalOpen(false)}>Annuler</button>
                                <button type="submit" className="primary-btn">Mettre à jour</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
