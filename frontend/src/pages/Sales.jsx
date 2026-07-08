import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Search, ShoppingCart, Trash2, Printer, CheckCircle2, XCircle, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import './Sales.css';

export default function Sales() {
    const { token, user } = useContext(AuthContext);
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [customers, setCustomers] = useState([]);
    const [settings, setSettings] = useState({});

    // Checkout specifics
    const [discountPercent, setDiscountPercent] = useState(0);
    const [taxPercent, setTaxPercent] = useState(0); // 0 or whatever fixed rate is
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [saleType, setSaleType] = useState('ticket');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');

    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [printingStatus, setPrintingStatus] = useState(null);

    // Preserved snapshot for printing (cart is cleared after checkout)
    const [printedCart, setPrintedCart] = useState([]);
    const [printedTotals, setPrintedTotals] = useState({ subtotal: 0, discount: 0, tax: 0, total: 0, payment: 'cash', date: '', type: 'ticket', customer: null });

    const barcodeInputRef = useRef(null);

    useEffect(() => {
        // Fetch products to act as a local cache for fast lookup via barcode
        fetch('http://localhost:3001/api/products', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json())
            .then(setProducts)
            .catch();

        fetch('http://localhost:3001/api/customers', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json())
            .then(setCustomers)
            .catch();

        fetch('http://localhost:3001/api/admin/settings', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json())
            .then(setSettings)
            .catch();
    }, [token]);

    // Handle Barcode scanner wedge input
    const handleBarcodeSubmit = (e) => {
        e.preventDefault();
        if (!barcodeInput.trim()) return;

        // Find product
        const prod = products.find(p => p.barcode === barcodeInput || p.sku === barcodeInput);
        if (!prod) {
            toast.error('Produit introuvable pour ' + barcodeInput);
            setBarcodeInput('');
            return;
        }

        addToCart(prod);
        setBarcodeInput('');
    };

    const addToCart = (prod) => {
        setCart(prev => {
            const existing = prev.find(item => item.product_id === prod.id);
            if (existing) {
                return prev.map(item => item.product_id === prod.id
                    ? { ...item, quantity: item.quantity + 1, line_total_cents: (item.quantity + 1) * item.unit_price_cents }
                    : item
                );
            }
            return [...prev, {
                product_id: prod.id,
                name: prod.name,
                quantity: 1,
                unit_price_cents: prod.selling_price,
                line_total_cents: prod.selling_price
            }];
        });
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(i => i.product_id !== id));
    };

    const changeQuantity = (id, newQty) => {
        if (newQty < 1) return removeFromCart(id);
        setCart(prev => prev.map(item => item.product_id === id
            ? { ...item, quantity: newQty, line_total_cents: newQty * item.unit_price_cents }
            : item
        ));
    };

    const subtotalCents = cart.reduce((sum, item) => sum + item.line_total_cents, 0);
    const discountCents = Math.round(subtotalCents * (discountPercent / 100));
    const subtotalAfterDiscount = subtotalCents - discountCents;
    const taxCents = Math.round(subtotalAfterDiscount * (taxPercent / 100));
    const totalCents = subtotalAfterDiscount + taxCents;

    const handleCheckout = async () => {
        if (cart.length === 0) return toast.error("Le panier est vide");
        if (saleType === 'facture' && !selectedCustomerId) return toast.error("Veuillez sélectionner un client pour la facture");

        try {
            const payload = {
                type: saleType,
                total_cents: totalCents,
                discount_cents: discountCents,
                tax_cents: taxCents,
                customer_id: selectedCustomerId || null,
                payment_method: paymentMethod,
                items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price_cents: i.unit_price_cents, line_total_cents: i.line_total_cents }))
            };

            const res = await fetch('http://localhost:3001/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(`${saleType === 'facture' ? 'Facture' : 'Ticket'} created successfully!`);
                setCheckoutModalOpen(false);
                // Snapshot the cart before clearing it
                setPrintedCart([...cart]);
                setPrintedTotals({
                    subtotal: subtotalCents,
                    discount: discountCents,
                    tax: taxCents,
                    total: totalCents,
                    payment: paymentMethod,
                    date: new Date().toLocaleString('fr-TN'),
                    type: saleType,
                    customer: selectedCustomerId ? customers.find(c => c.id == selectedCustomerId) : null
                });
                setPrintingStatus(saleType === 'facture' ? 'PDF Export Ready' : 'Print Thermal Receipt');
                setCart([]);
            } else {
                toast.error(data.error);
            }
        } catch (e) {
            toast.error('Checkout failed');
        }
    };

    return (
        <div className="pos-layout">
            <div className="pos-main">
                <div className="page-header">
                    <h1>Nouvelle vente</h1>
                </div>

                <form className="barcode-form" onSubmit={handleBarcodeSubmit} style={{ marginBottom: '16px' }}>
                    <Search className="search-icon" size={20} />
                    <input
                        ref={barcodeInputRef}
                        type="text"
                        className="barcode-input"
                        placeholder="Scanner le code-barres ou entrer le SKU..."
                        value={barcodeInput}
                        onChange={e => setBarcodeInput(e.target.value)}
                        autoFocus
                    />
                </form>
                <div className="cart-container card">
                    <table className="modern-table pos-table">
                        <thead>
                            <tr>
                                <th>Produit</th>
                                <th>Prix</th>
                                <th>Qté</th>
                                <th>Total</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.map(item => (
                                <tr key={item.product_id}>
                                    <td className="product-name">{item.name}</td>
                                    <td>{(item.unit_price_cents / 100).toFixed(3)} DT</td>
                                    <td>
                                        <div className="qty-controls">
                                            <button onClick={() => changeQuantity(item.product_id, item.quantity - 1)}>-</button>
                                            <input type="number" readOnly value={item.quantity} />
                                            <button onClick={() => changeQuantity(item.product_id, item.quantity + 1)}>+</button>
                                        </div>
                                    </td>
                                    <td>{(item.line_total_cents / 100).toFixed(3)} DT</td>
                                    <td>
                                        <button className="icon-btn delete-btn" onClick={() => removeFromCart(item.product_id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {cart.length === 0 && <tr><td colSpan="5" className="empty-cart">Scannez des articles pour les ajouter au panier.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="pos-sidebar card">
                <h2 className="resume-title">
                    <ShoppingBag size={20} />
                    Résumé
                </h2>

                <div className="totals-row">
                    <span>Sous-total</span>
                    <span>{(subtotalCents / 100).toFixed(3)} DT</span>
                </div>

                <div className="resume-settings-box">
                    <div className="settings-group">
                        <div>
                            <label>Remise (%)</label>
                            <input className="form-control" type="number" min="0" max="100" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} />
                        </div>
                        <div>
                            <label>TVA (%)</label>
                            <input className="form-control" type="number" min="0" max="100" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="totals-breakdown">
                    <div className="totals-row sub-row text-red">
                        <span>Remise ({discountPercent || 0}%)</span>
                        <span>-{(discountCents / 100).toFixed(3)} DT</span>
                    </div>
                    <div className="totals-row sub-row">
                        <span>Taxe ({taxPercent || 0}%)</span>
                        <span>+{(taxCents / 100).toFixed(3)} DT</span>
                    </div>
                </div>

                <div className="grand-total-box">
                    <span className="grand-total-label">Total à payer</span>
                    <span className="grand-total">{(totalCents / 100).toFixed(3)} DT</span>
                </div>

                <button
                    className="pos-checkout-btn"
                    disabled={cart.length === 0}
                    style={{ flex: 1, borderRadius: '12px', fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: 'auto', boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)', transition: 'all 0.2s', cursor: cart.length > 0 ? 'pointer' : 'not-allowed', filter: cart.length === 0 ? 'grayscale(1)' : 'none' }}
                    onMouseEnter={e => { if (cart.length > 0) e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { if (cart.length > 0) e.currentTarget.style.transform = 'translateY(0)' }}
                    onClick={() => {
                        setSaleType('ticket');
                        setPaymentMethod('cash');
                        setSelectedCustomerId('');
                        setCheckoutModalOpen(true);
                    }}
                >
                    <ShoppingCart size={24} /> Encaisser
                </button>
            </div>

            {isCheckoutModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content checkout-modal">
                        <h2>Finaliser la vente</h2>
                        <div className="checkout-options">
                            {saleType === 'ticket' ? (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                                    <button type="button" className="ghost-btn" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => setSaleType('facture')}>
                                        📄 Imprimer une facture ?
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'rgba(79, 70, 229, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <strong style={{ color: '#4f46e5' }}>📄 Mode Facture</strong>
                                    <button type="button" className="ghost-btn" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => setSaleType('ticket')}>
                                        ❌ Annuler la facture
                                    </button>
                                </div>
                            )}

                            {saleType === 'facture' && (
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label>Sélectionner un client</label>
                                    <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} required>
                                        <option value="">-- Choisir un client --</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.company_name ? `(${c.company_name})` : ''}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Mode de paiement</label>
                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                    <option value="cash">Espèces</option>
                                    <option value="card">Carte bancaire</option>
                                    <option value="mixed">Mixte/Autre</option>
                                </select>
                            </div>
                        </div>

                        <div className="modal-actions span-2">
                            <button type="button" className="ghost-btn" onClick={() => setCheckoutModalOpen(false)}>Annuler</button>
                            <button onClick={handleCheckout} className="primary-btn pay-btn">Confirmer le paiement - {(totalCents / 100).toFixed(3)} DT</button>
                        </div>
                    </div>
                </div>
            )}

            {printingStatus && (
                <div className="modal-overlay">
                    <div className="modal-content text-center">
                        <CheckCircle2 size={48} color="#22c55e" style={{ margin: '0 auto 20px' }} />
                        <h2>Transaction terminée !</h2>
                        <p>Étape suivante : <strong>{printingStatus}</strong></p>
                        <button className="primary-btn" onClick={() => {
                            if (window.electronAPI && printedTotals.type) {
                                const itemRows = printedCart.map((item, idx) =>
                                    `<tr style="background:${idx % 2 === 0 ? '#fafafa' : '#fff'};border-bottom:1px solid #ede9fe">
                                        <td style="padding:8px 12px;font-size:13px">${item.name}</td>
                                        <td style="padding:8px 12px;text-align:center;font-size:13px">${item.quantity}</td>
                                        <td style="padding:8px 12px;text-align:right;font-size:13px">${(item.unit_price_cents / 100).toFixed(3)} DT</td>
                                        <td style="padding:8px 12px;text-align:right;font-size:13px;font-weight:600">${(item.line_total_cents / 100).toFixed(3)} DT</td>
                                    </tr>`
                                ).join('');
                                const isFacture = printedTotals.type === 'facture';
                                const html = isFacture ? `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Facture</title>
                                <style>body{font-family:Arial,sans-serif;margin:40px;color:#111;font-size:13px}table{width:100%;border-collapse:collapse}</style></head>
                                <body>
                                <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);height:6px;border-radius:3px;margin-bottom:30px"></div>
                                <div style="display:flex;justify-content:space-between;margin-bottom:30px;padding-bottom:16px;border-bottom:2px solid #ede9fe">
                                    <div>
                                        <div style="font-size:20px;font-weight:800;color:#1e1b4b">${settings.store_name || 'Mon Magasin'}</div>
                                        ${settings.store_mf ? `<div style="font-size:12px;color:#555;margin-top:4px">M.F : ${settings.store_mf}</div>` : ''}
                                        ${settings.store_phone ? `<div style="font-size:12px;color:#555;margin-top:2px">Tél : ${settings.store_phone}</div>` : ''}
                                        ${settings.store_address ? `<div style="font-size:12px;color:#555;margin-top:2px">${settings.store_address}</div>` : ''}
                                    </div>
                                    <div style="text-align:right">
                                        <div style="font-size:15px;font-weight:700;color:#1e1b4b">${printedTotals.customer?.name || ''}</div>
                                        ${printedTotals.customer?.company_name ? `<div style="font-size:12px;color:#555;margin-top:2px">${printedTotals.customer.company_name}</div>` : ''}
                                        ${printedTotals.customer?.phone ? `<div style="font-size:12px;color:#555;margin-top:2px">Tél : ${printedTotals.customer.phone}</div>` : ''}
                                    </div>
                                </div>
                                <div style="display:flex;justify-content:space-between;margin-bottom:20px">
                                    <div style="font-size:24px;font-weight:800;color:#4f46e5">FACTURE</div>
                                    <div style="font-size:12px;color:#666">Date : ${printedTotals.date}</div>
                                </div>
                                <table>
                                    <thead><tr style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white">
                                        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase">Désignation</th>
                                        <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase">Qté</th>
                                        <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase">P.U</th>
                                        <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase">Total</th>
                                    </tr></thead>
                                    <tbody>${itemRows}</tbody>
                                </table>
                                <div style="display:flex;justify-content:flex-end;margin-top:20px">
                                    <div style="width:260px;border-top:2px solid #ede9fe;padding-top:12px">
                                        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#555">
                                            <span>Sous-total</span><span>${(printedTotals.subtotal / 100).toFixed(3)} DT</span></div>
                                        ${printedTotals.discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#e53e3e"><span>Remise</span><span>-${(printedTotals.discount / 100).toFixed(3)} DT</span></div>` : ''}
                                        ${printedTotals.tax > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#555"><span>TVA</span><span>+${(printedTotals.tax / 100).toFixed(3)} DT</span></div>` : ''}
                                        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;padding:10px 16px;border-radius:8px;display:flex;justify-content:space-between;margin-top:8px;font-weight:700">
                                            <span>TOTAL À PAYER</span><span>${(printedTotals.total / 100).toFixed(3)} DT</span></div>
                                    </div>
                                </div>
                                </body></html>`
                                    : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket</title>
                                <style>body{font-family:'Courier New',monospace;width:80mm;margin:0 auto;padding:10px;font-size:13px}
                                .divider{text-align:center;letter-spacing:2px;margin:6px 0}
                                table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
                                .right{text-align:right}.total{font-weight:bold;font-size:1.1em}</style></head>
                                <body>
                                <div class="divider">--------------------------------</div>
                                <p style="margin:2px">Date: ${printedTotals.date}</p>
                                <div class="divider">================================</div>
                                <table><tbody>
                                ${printedCart.map(item => `<tr><td>${item.name}<br><small>${item.quantity} x ${(item.unit_price_cents / 100).toFixed(3)}</small></td><td class="right"><strong>${(item.line_total_cents / 100).toFixed(3)} DT</strong></td></tr>`).join('')}
                                </tbody></table>
                                <div class="divider">--------------------------------</div>
                                <div style="display:flex;justify-content:space-between"><span>Sous-total</span><span>${(printedTotals.subtotal / 100).toFixed(3)} DT</span></div>
                                ${printedTotals.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Remise</span><span>-${(printedTotals.discount / 100).toFixed(3)} DT</span></div>` : ''}
                                ${printedTotals.tax > 0 ? `<div style="display:flex;justify-content:space-between"><span>TVA</span><span>+${(printedTotals.tax / 100).toFixed(3)} DT</span></div>` : ''}
                                <div class="divider">================================</div>
                                <div class="total" style="display:flex;justify-content:space-between"><span>TOTAL</span><span>${(printedTotals.total / 100).toFixed(3)} DT</span></div>
                                <div class="divider">--------------------------------</div>
                                <p style="text-align:center;margin:6px 0">Merci de votre visite !</p>
                                <p style="text-align:center;margin:2px">À très bientôt</p>
                                </body></html>`;
                                window.electronAPI.printHtml(html);
                            } else {
                                window.print();
                            }
                        }} style={{ margin: '20px auto 0' }}>
                            <Printer size={18} /> Imprimer maintenant
                        </button>
                        <button className="ghost-btn" style={{ marginTop: '10px' }} onClick={() => { setPrintingStatus(null); barcodeInputRef.current?.focus(); }}>
                            Fermer & Nouvelle vente
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden Print Section — uses snapshot to survive cart clear */}
            <div className="print-only">
                {printedTotals.type === 'ticket' ? (
                    <div className="thermal-print">
                        <div className="receipt-header">
                            {/*{settings.store_mf && <p>MF: {settings.store_mf}</p>}
                            {settings.store_address && <p>{settings.store_address}</p>}
                            {settings.store_phone && <p>Tél: {settings.store_phone}</p>}*/}
                            <div className="receipt-divider">--------------------------------</div>
                            <p>Date: {printedTotals.date}</p>
                            <p>Caissier: {user?.username}</p>
                            <div className="receipt-divider">================================</div>
                        </div>

                        <table className="receipt-table">
                            <thead>
                                <tr>
                                    <td><strong>Article</strong></td>
                                    <td style={{ textAlign: 'center' }}><strong>Qté</strong></td>
                                    <td style={{ textAlign: 'right' }}><strong>Total</strong></td>
                                </tr>
                            </thead>
                            <tbody>
                                {printedCart.map(item => (
                                    <tr key={item.product_id}>
                                        <td>{item.name}</td>
                                        <td style={{ textAlign: 'center' }}>{item.quantity} x {(item.unit_price_cents / 100).toFixed(3)}</td>
                                        <td style={{ textAlign: 'right' }}><strong>{(item.line_total_cents / 100).toFixed(3)} DT</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="receipt-divider">--------------------------------</div>

                        <div className="receipt-totals">
                            <div className="receipt-row">
                                <span>Sous-total</span>
                                <span>{(printedTotals.subtotal / 100).toFixed(3)} DT</span>
                            </div>
                            {printedTotals.discount > 0 && (
                                <div className="receipt-row">
                                    <span>Remise</span>
                                    <span>-{(printedTotals.discount / 100).toFixed(3)} DT</span>
                                </div>
                            )}
                            {printedTotals.tax > 0 && (
                                <div className="receipt-row">
                                    <span>TVA</span>
                                    <span>+{(printedTotals.tax / 100).toFixed(3)} DT</span>
                                </div>
                            )}
                            <div className="receipt-divider">================================</div>
                            <div className="receipt-row receipt-grand-total">
                                <span>TOTAL</span>
                                <span>{(printedTotals.total / 100).toFixed(3)} DT</span>
                            </div>
                            <br />
                            <div className="receipt-row">
                                <span>Paiement:</span>
                                <span>{printedTotals.payment.toUpperCase()}</span>
                            </div>
                        </div>

                        <div className="receipt-divider">--------------------------------</div>

                        <div className="receipt-footer">
                            <p>Merci de votre visite !</p>
                            <p>À très bientôt</p>
                            <br />
                            <p>** VEUILLEZ CONSERVER CE TICKET **</p>
                        </div>
                    </div>
                ) : (
                    <div className="facture-print">
                        {/* Top accent bar */}
                        <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', height: '6px', marginBottom: '32px', borderRadius: '3px' }} />

                        {/* Header: Store left, Client right */}
                        <div className="print-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px' }}>
                            <div>
                                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e1b4b', marginBottom: '6px' }}>
                                    {settings.store_name || 'Mon Magasin'}
                                </div>
                                {settings.store_mf && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>M.F : {settings.store_mf}</div>}
                                {settings.store_phone && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>Tél : {settings.store_phone}</div>}
                                {settings.store_address && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{settings.store_address}</div>}
                            </div>
                            <div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e1b4b' }}>{printedTotals.customer?.name || '—'}</div>
                                {printedTotals.customer?.company_name && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{printedTotals.customer.company_name}</div>}
                                {printedTotals.customer?.matricule_fiscal && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>M.F : {printedTotals.customer.matricule_fiscal}</div>}
                                {printedTotals.customer?.phone && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>Tél : {printedTotals.customer.phone}</div>}
                                {printedTotals.customer?.address && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{printedTotals.customer.address}</div>}
                            </div>
                        </div>

                        {/* Invoice title + ref */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '2px solid #ede9fe' }}>
                            <div style={{ fontSize: '26px', fontWeight: 800, color: '#4f46e5', letterSpacing: '0.04em' }}>FACTURE</div>
                            <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
                                <div><strong>Date :</strong> {printedTotals.date}</div>
                            </div>
                        </div>

                        {/* Items table */}
                        <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                            <thead>
                                <tr style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white' }}>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Désignation</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Qté</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>P.U</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {printedCart.map((item, idx) => (
                                    <tr key={item.product_id} style={{ background: idx % 2 === 0 ? '#fafafa' : '#ffffff', borderBottom: '1px solid #ede9fe' }}>
                                        <td style={{ padding: '10px 14px', fontSize: '13px', color: '#111' }}>{item.name}</td>
                                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '13px', color: '#444' }}>{item.quantity}</td>
                                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', color: '#444' }}>{(item.unit_price_cents / 100).toFixed(3)} DT</td>
                                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{(item.line_total_cents / 100).toFixed(3)} DT</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals block */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '260px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#555', borderBottom: '1px solid #e5e7eb' }}>
                                    <span>Sous-total</span><span>{(printedTotals.subtotal / 100).toFixed(3)} DT</span>
                                </div>
                                {printedTotals.discount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#ef4444', borderBottom: '1px solid #e5e7eb' }}>
                                        <span>Remise</span><span>-{(printedTotals.discount / 100).toFixed(3)} DT</span>
                                    </div>
                                )}
                                {printedTotals.tax > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#555', borderBottom: '1px solid #e5e7eb' }}>
                                        <span>TVA</span><span>+{(printedTotals.tax / 100).toFixed(3)} DT</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', marginTop: '6px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', borderRadius: '8px', color: 'white' }}>
                                    <span style={{ fontWeight: 700, fontSize: '14px' }}>TOTAL À PAYER</span>
                                    <span style={{ fontWeight: 800, fontSize: '16px' }}>{(printedTotals.total / 100).toFixed(3)} DT</span>
                                </div>
                            </div>
                        </div>

                        {/* Bottom bar */}
                        <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', height: '4px', marginTop: '40px', borderRadius: '2px' }} />
                        <div style={{ textAlign: 'center', fontSize: '11px', color: '#888', marginTop: '10px' }}>
                            Merci pour votre confiance — {settings.store_name || ''}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
