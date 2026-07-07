import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Receipt, FileText, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Customers() {
    const { token, user } = useContext(AuthContext);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [customerSales, setCustomerSales] = useState({});
    const [salesLoading, setSalesLoading] = useState({});

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({
        name: '', company_name: '', tax_id: '', matricule_fiscal: '', address: '', phone: ''
    });

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const res = await fetch('http://localhost:3001/api/customers', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setCustomers(data);
        } catch (e) {
            toast.error('Échec du chargement des clients');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomerSales = async (customerId) => {
        if (customerSales[customerId]) return; // already loaded
        setSalesLoading(prev => ({ ...prev, [customerId]: true }));
        try {
            const res = await fetch(`http://localhost:3001/api/customers/${customerId}/sales`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setCustomerSales(prev => ({ ...prev, [customerId]: data }));
        } catch (e) {
            toast.error('Erreur de chargement des ventes');
        } finally {
            setSalesLoading(prev => ({ ...prev, [customerId]: false }));
        }
    };

    const toggleExpand = (customerId) => {
        if (expandedId === customerId) {
            setExpandedId(null);
        } else {
            setExpandedId(customerId);
            fetchCustomerSales(customerId);
        }
    };

    useEffect(() => { fetchCustomers(); }, [token]);

    const openModal = (customer = null) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                name: customer.name || '', company_name: customer.company_name || '',
                tax_id: customer.tax_id || '', matricule_fiscal: customer.matricule_fiscal || '',
                address: customer.address || '', phone: customer.phone || ''
            });
        } else {
            setEditingCustomer(null);
            setFormData({ name: '', company_name: '', tax_id: '', matricule_fiscal: '', address: '', phone: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = editingCustomer
            ? `http://localhost:3001/api/customers/${editingCustomer.id}`
            : 'http://localhost:3001/api/customers';
        const method = editingCustomer ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Client ${editingCustomer ? 'modifié' : 'créé'} avec succès`);
                setIsModalOpen(false);
                // Invalidate cached sales for this customer if edited
                if (editingCustomer) {
                    setCustomerSales(prev => { const n = { ...prev }; delete n[editingCustomer.id]; return n; });
                }
                fetchCustomers();
            } else {
                toast.error(data.error);
            }
        } catch (e) {
            toast.error('Erreur lors de la sauvegarde');
        }
    };

    const handleDelete = async (c) => {
        if (!window.confirm(`Supprimer le client "${c.name}" ?`)) return;
        try {
            const res = await fetch(`http://localhost:3001/api/customers/${c.id}`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) { toast.success('Client supprimé'); fetchCustomers(); }
            else toast.error(data.error);
        } catch (e) {
            toast.error('Erreur lors de la suppression');
        }
    };

    const formatMoney = (cents) => (cents / 100).toFixed(3) + ' DT';

    const reprintSale = async (sale, customer) => {
        // Fetch store settings first
        let store = { store_name: '', store_mf: '', store_address: '', store_phone: '' };
        try {
            const res = await fetch('http://localhost:3001/api/admin/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) store = await res.json();
        } catch (_) { /* use empty defaults */ }

        const isFacture = sale.type === 'facture';
        const itemRows = (sale.items || []).map(itm =>
            `<tr>
                <td style="padding:7px 10px;border-bottom:1px solid #eee">${itm.product_name}</td>
                <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center">${itm.quantity}</td>
                <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right">${(itm.unit_price_cents / 100).toFixed(3)} DT</td>
                <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right">${(itm.line_total_cents / 100).toFixed(3)} DT</td>
            </tr>`
        ).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${isFacture ? 'Facture' : 'Ticket'} ${sale.invoice_number || '#' + sale.id}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 36px; color: #111; font-size: 13px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 2px solid #222; }
            .store-info { text-align: left; }
            .client-info { text-align: right; }
            .store-info h2, .client-info h2 { font-size: 14px; text-transform: uppercase; margin: 0 0 4px; color: #444; letter-spacing: 0.05em; }
            .store-name { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
            .meta-line { margin: 2px 0; color: #555; }
            .doc-title { text-align: center; margin: 20px 0 16px; font-size: 20px; font-weight: 700; letter-spacing: 0.05em; }
            .doc-ref { text-align: center; color: #555; margin-bottom: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; padding: 8px 10px; background: #f4f4f4; border-bottom: 2px solid #ccc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
            td { font-size: 13px; }
            .total-row td { font-weight: 700; font-size: 14px; padding: 12px 10px; border-top: 2px solid #222; }
            @media print { body { margin: 20px; } }
        </style></head>
        <body>
            <div class="header">
                <div class="store-info">
                    <p class="store-name">${store.store_name || 'Mon Magasin'}</p>
                    ${store.store_mf ? `<p class="meta-line">M.F : ${store.store_mf}</p>` : ''}
                    ${store.store_phone ? `<p class="meta-line">Tél : ${store.store_phone}</p>` : ''}
                    ${store.store_address ? `<p class="meta-line">${store.store_address}</p>` : ''}
                </div>
                <div class="client-info">
                    <h2>Facturé à</h2>
                    <p class="store-name" style="font-size:15px">${customer.name}</p>
                    ${customer.company_name ? `<p class="meta-line">${customer.company_name}</p>` : ''}
                    ${customer.matricule_fiscal ? `<p class="meta-line">M.F : ${customer.matricule_fiscal}</p>` : ''}
                    ${customer.phone ? `<p class="meta-line">Tél : ${customer.phone}</p>` : ''}
                    ${customer.address ? `<p class="meta-line">${customer.address}</p>` : ''}
                </div>
            </div>

            <div class="doc-title">${isFacture ? 'FACTURE' : 'TICKET DE CAISSE'}</div>
            <div class="doc-ref">Réf : ${sale.invoice_number || '#' + sale.id} &nbsp;|&nbsp; Date : ${new Date(sale.created_at).toLocaleDateString('fr-TN')}</div>

            <table>
                <thead><tr><th>Désignation</th><th style="text-align:center">Qté</th><th style="text-align:right">P.U</th><th style="text-align:right">Total</th></tr></thead>
                <tbody>${itemRows}</tbody>
                <tfoot><tr class="total-row"><td colspan="3" style="text-align:right">TOTAL À PAYER</td><td style="text-align:right">${formatMoney(sale.total_cents)}</td></tr></tfoot>
            </table>
        </body></html>`;

        if (window.electronAPI) {
            window.electronAPI.printHtml(html);
        } else {
            const w = window.open('', '_blank', 'width=750,height=960');
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => w.print(), 400);
        }
    };


    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1>Gestion des Clients</h1>
                </div>
                <button className="primary-btn" onClick={() => openModal()}>
                    <Plus size={18} /> Nouveau Client
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Chargement...</div>
                ) : (
                    <table className="data-table" style={{ marginBottom: 0, width: '100%', tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '40px' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '14%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th></th>
                                <th>Nom du Client</th>
                                <th>Entreprise</th>
                                <th>Matricule Fiscal</th>
                                <th>Téléphone</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.length === 0 && (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Aucun client trouvé.</td></tr>
                            )}
                            {customers.map(c => (
                                <>
                                    <tr
                                        key={c.id}
                                        style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                                        onClick={() => toggleExpand(c.id)}
                                        className="customer-row"
                                    >
                                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                                            {expandedId === c.id
                                                ? <ChevronDown size={16} />
                                                : <ChevronRight size={16} />}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</div>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)' }}>{c.company_name || '—'}</td>
                                        <td>
                                            {c.matricule_fiscal
                                                ? <span style={{ fontFamily: 'monospace', fontSize: '0.88rem', background: 'var(--bg-main)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>{c.matricule_fiscal}</span>
                                                : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)' }}>{c.phone || '—'}</td>
                                        <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                            <button className="icon-btn edit-btn" onClick={() => openModal(c)} title="Modifier"><Edit size={16} /></button>
                                            {user?.role === 'admin' && (
                                                <button className="icon-btn delete-btn" onClick={() => handleDelete(c)} title="Supprimer"><Trash2 size={16} /></button>
                                            )}
                                        </td>
                                    </tr>

                                    {expandedId === c.id && (
                                        <tr key={`${c.id}-detail`}>
                                            <td colSpan="6" style={{ background: 'var(--bg-main)', padding: '0' }}>
                                                <div style={{ padding: '20px 28px', borderTop: '1px solid var(--border-color)' }}>
                                                    <h4 style={{ marginBottom: '14px', color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                        Historique des achats — {c.name}
                                                    </h4>
                                                    {salesLoading[c.id] ? (
                                                        <p>Chargement...</p>
                                                    ) : !customerSales[c.id] || customerSales[c.id].length === 0 ? (
                                                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune transaction trouvée pour ce client.</p>
                                                    ) : (
                                                        <table className="modern-table" style={{ marginBottom: 0 }}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Type</th>
                                                                    <th>N° Facture</th>
                                                                    <th>Date</th>
                                                                    <th style={{ textAlign: 'right' }}>Total</th>
                                                                    <th></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {customerSales[c.id].map(sale => (
                                                                    <tr key={sale.id}>
                                                                        <td>
                                                                            <span style={{
                                                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                                                background: sale.type === 'facture' ? 'rgba(79,70,229,0.12)' : 'rgba(34,197,94,0.12)',
                                                                                color: sale.type === 'facture' ? '#6366f1' : '#22c55e',
                                                                                padding: '3px 8px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600
                                                                            }}>
                                                                                {sale.type === 'facture' ? <FileText size={12} /> : <Receipt size={12} />}
                                                                                {sale.type === 'facture' ? 'Facture' : 'Ticket'}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}>{sale.invoice_number || `#${sale.id}`}</td>
                                                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{new Date(sale.created_at).toLocaleDateString('fr-TN')}</td>
                                                                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{formatMoney(sale.total_cents)}</td>
                                                                        <td style={{ textAlign: 'right' }}>
                                                                            <button
                                                                                title="Réimprimer"
                                                                                onClick={() => reprintSale(sale, c)}
                                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted)', transition: 'all 0.2s' }}
                                                                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
                                                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                                            >
                                                                                <Printer size={13} /> Réimprimer
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>{editingCustomer ? 'Modifier Client' : 'Nouveau Client'}</h2>
                        <form onSubmit={handleSubmit} className="grid-form">
                            <div className="form-group span-2">
                                <label>Nom du Client <span style={{ color: 'red' }}>*</span></label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Nom de l'Entreprise</label>
                                <input type="text" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Matricule Fiscal</label>
                                <input type="text" value={formData.matricule_fiscal} onChange={e => setFormData({ ...formData, matricule_fiscal: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>N° Téléphone</label>
                                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div className="form-group span-2">
                                <label>Adresse Complète</label>
                                <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    style={{ height: '80px', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-main)', color: 'var(--text-main)', resize: 'none', width: '100%' }} />
                            </div>
                            <div className="modal-actions span-2">
                                <button type="button" className="ghost-btn" onClick={() => setIsModalOpen(false)}>Annuler</button>
                                <button type="submit" className="primary-btn">Sauvegarder</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
