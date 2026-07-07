import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { BarChart3, TrendingUp, Package, Calendar, List, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import './Reports.css';

// Helper to convert ISO week string (YYYY-Www) to date ranges
function getDatesFromWeekInput(weekStr) {
    const [year, week] = weekStr.split('-W');
    const d = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = d.getDay();
    const ISOweekStart = d;
    if (dow <= 4) {
        ISOweekStart.setDate(d.getDate() - d.getDay() + 1);
    } else {
        ISOweekStart.setDate(d.getDate() + 8 - d.getDay());
    }
    const end = new Date(ISOweekStart);
    end.setDate(end.getDate() + 6);
    return {
        start: ISOweekStart.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

export default function Reports() {
    const { token, user } = useContext(AuthContext);
    const [summary, setSummary] = useState(null);
    const [bestSellers, setBestSellers] = useState([]);
    const [breakdown, setBreakdown] = useState(null);

    // Filtering
    const [filterType, setFilterType] = useState('day'); // 'day', 'week', 'month'
    const [filterValue, setFilterValue] = useState(new Date().toISOString().split('T')[0]); // Initial default is today's date

    // Compute Date Range to send to backend
    const getComputedDates = () => {
        if (!filterValue) return { start_date: '', end_date: '' };
        if (filterType === 'day') {
            return { start_date: filterValue, end_date: filterValue };
        } else if (filterType === 'month') {
            const start = `${filterValue}-01`;
            const date = new Date(start);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            return { start_date: start, end_date: lastDay.toISOString().split('T')[0] };
        } else if (filterType === 'week') {
            const range = getDatesFromWeekInput(filterValue);
            return { start_date: range.start, end_date: range.end };
        }
        return { start_date: '', end_date: '' };
    };

    const fetchReports = async () => {
        const { start_date, end_date } = getComputedDates();
        if (!start_date || !end_date) return;

        try {
            const qs = `?start_date=${start_date}&end_date=${end_date}&filter_type=${filterType}`;

            const resSum = await fetch(`http://localhost:3001/api/reports/summary${qs}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resSum.ok) setSummary(await resSum.json());

            const resBest = await fetch(`http://localhost:3001/api/reports/best-sellers${qs}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resBest.ok) setBestSellers(await resBest.json());

            const resBreakdown = await fetch(`http://localhost:3001/api/reports/breakdown${qs}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resBreakdown.ok) setBreakdown(await resBreakdown.json());

        } catch (e) {
            toast.error('Échec du chargement des rapports');
        }
    };

    useEffect(() => {
        if (user?.role === 'admin') {
            // Re-fetch automatically when filters change
            fetchReports();
        }
    }, [token, filterType, filterValue]);

    // Format utility functions for display
    const formatMoney = cents => (cents / 100).toFixed(3) + ' DT';

    if (user?.role !== 'admin') {
        return <div className="card"><h3>Accès refusé</h3><p>Seuls les administrateurs peuvent consulter les rapports.</p></div>;
    }

    return (
        <>
            <div className="reports-page">
                <div className="page-header">
                    <h1>Rapports & Analyses</h1>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="date-filters card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calendar size={18} color="var(--text-muted)" />
                        <select className="form-control" value={filterType} onChange={e => {
                            const type = e.target.value;
                            setFilterType(type);
                            const now = new Date();
                            if (type === 'day') {
                                setFilterValue(now.toISOString().split('T')[0]);
                            } else if (type === 'week') {
                                const year = now.getFullYear();
                                const startOfYear = new Date(year, 0, 1);
                                const weekNo = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
                                setFilterValue(`${year}-W${String(weekNo).padStart(2, '0')}`);
                            } else if (type === 'month') {
                                const mm = String(now.getMonth() + 1).padStart(2, '0');
                                setFilterValue(`${now.getFullYear()}-${mm}`);
                            }
                        }}>
                            <option value="day">Un Jour</option>
                            <option value="week">Une Semaine</option>
                            <option value="month">Un Mois</option>
                        </select>
                        {filterType === 'day' && <input type="date" className="form-control" value={filterValue} onChange={e => setFilterValue(e.target.value)} />}
                        {filterType === 'week' && <input type="week" className="form-control" value={filterValue} onChange={e => setFilterValue(e.target.value)} />}
                        {filterType === 'month' && <input type="month" className="form-control" value={filterValue} onChange={e => setFilterValue(e.target.value)} />}
                    </div>
                </div>
                {summary && (
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon revenue-icon"><TrendingUp size={24} /></div>
                            <div className="stat-info">
                                <span className="stat-label">Chiffre d'affaires</span>
                                <span className="stat-value">{formatMoney(summary.total_revenue || 0)}</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon profit-icon"><BarChart3 size={24} /></div>
                            <div className="stat-info">
                                <span className="stat-label">Bénéfice net</span>
                                <span className="stat-value">{formatMoney(summary.total_profit || 0)}</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon tx-icon"><Package size={24} /></div>
                            <div className="stat-info">
                                <span className="stat-label">Transactions</span>
                                <span className="stat-value">{summary.transaction_count || 0}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="reports-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <List size={20} color="#4f46e5" />
                            <h2 style={{ margin: 0 }}>
                                {filterType === 'day' ? 'Détails des Ventes' : 'Totaux par Jour'}
                            </h2>
                        </div>

                        {breakdown && breakdown.type === 'details' && (
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Heure</th>
                                        <th>Facture / N°</th>
                                        <th>Caissier</th>
                                        <th>Client</th>
                                        <th>Total (DT)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breakdown.data.length > 0 ? breakdown.data.map(txn => (
                                        <tr key={txn.id}>
                                            <td>{new Date(txn.created_at).toLocaleTimeString('fr-TN')}</td>
                                            <td>{txn.invoice_number || `TICKET-${txn.id}`}</td>
                                            <td>{txn.cashier_name}</td>
                                            <td>{txn.customer_name || '-'}</td>
                                            <td><strong>{formatMoney(txn.total_cents)}</strong></td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Aucune transaction trouvée</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {breakdown && breakdown.type === 'aggregates' && (
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Nombre de Transactions</th>
                                        <th>Total Ventes (DT)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breakdown.data.length > 0 ? breakdown.data.map((agg, idx) => (
                                        <tr key={idx}>
                                            <td>{new Date(agg.sale_date).toLocaleDateString('fr-TN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                                            <td>{agg.transaction_count}</td>
                                            <td><strong>{formatMoney(agg.total_revenue)}</strong></td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>Aucune donnée de vente trouvée</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="card" style={{ flex: 1 }}>
                        <h2>Meilleures ventes</h2>
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Produit</th>
                                    <th>Unités vendues</th>
                                    <th>Revenus générés</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bestSellers.length > 0 ? bestSellers.map(b => (
                                    <tr key={b.id}>
                                        <td>{b.name} <br /><span className="sku-text">{b.barcode || ''}</span></td>
                                        <td>{b.units_sold}</td>
                                        <td>{formatMoney(b.revenue)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune donnée pour cette période</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Floating Print Button */}
            <button
                onClick={() => window.electronAPI ? window.electronAPI.printCurrent() : window.print()}
                title="Imprimer le rapport"
                style={{
                    position: 'fixed',
                    bottom: '32px',
                    right: '32px',
                    zIndex: 9999,
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(99, 102, 241, 0.5)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(99, 102, 241, 0.7)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.5)'; }}
            >
                <Printer size={22} />
            </button>
        </>
    );
}
