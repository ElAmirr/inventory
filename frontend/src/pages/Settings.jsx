import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Store, ShieldAlert, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
    const { token, user } = useContext(AuthContext);
    const [settings, setSettings] = useState({ store_name: '', store_mf: '', store_address: '', store_phone: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('http://localhost:3001/api/admin/settings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) setSettings({ ...settings, ...data });
            } catch (e) {
                toast.error('Erreur lors du chargement des paramètres');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [token]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:3001/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                toast.success('Paramètres sauvegardés avec succès');
            } else {
                const data = await res.json();
                toast.error(data.error);
            }
        } catch (e) {
            toast.error('Erreur de sauvegarde');
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <ShieldAlert size={64} color="#ef4444" style={{ marginBottom: '20px' }} />
                <h2>Accès Refusé</h2>
                <p>Seuls les administrateurs peuvent accéder aux paramètres du magasin.</p>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1><Store size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '10px' }} /> Paramètres du Magasin</h1>
                </div>
            </div>

            <div className="card" style={{ maxWidth: '600px' }}>
                {loading ? (
                    <div className="loading-spinner">Chargement...</div>
                ) : (
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="form-group">
                            <label>Nom du Magasin / Raison Sociale</label>
                            <input type="text" value={settings.store_name || ''} onChange={e => setSettings({ ...settings, store_name: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label>Matricule Fiscal</label>
                            <input type="text" value={settings.store_mf || ''} onChange={e => setSettings({ ...settings, store_mf: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Numéro de Téléphone</label>
                            <input type="text" value={settings.store_phone || ''} onChange={e => setSettings({ ...settings, store_phone: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Adresse Complète</label>
                            <textarea value={settings.store_address || ''} onChange={e => setSettings({ ...settings, store_address: e.target.value })} style={{ height: '80px', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-main)', color: 'var(--text-main)', resize: 'none' }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                            <button type="submit" className="primary-btn">
                                <Save size={18} /> Mettre à jour
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
