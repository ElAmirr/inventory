import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { UserPlus, FolderPlus, Trash2, Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
    const { user, token } = useContext(AuthContext);

    // State for admins only
    const [users, setUsers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form states
    const [userForm, setUserForm] = useState({ username: '', password: '', role: 'cashier' });
    const [categoryName, setCategoryName] = useState('');

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchAdminData();
        }
    }, [user, token]);

    const fetchAdminData = async () => {
        setLoading(true);
        try {
            const [usersRes, catRes] = await Promise.all([
                fetch('http://localhost:3001/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('http://localhost:3001/api/admin/categories', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (usersRes.ok) setUsers(await usersRes.json());
            if (catRes.ok) setCategories(await catRes.json());
        } catch (e) {
            toast.error('Erreur lors du chargement des données admin');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:3001/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(userForm)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Utilisateur créé avec succès');
                setUserForm({ username: '', password: '', role: 'cashier' });
                fetchAdminData();
            } else {
                toast.error(data.error || 'Erreur lors de la création');
            }
        } catch (e) {
            toast.error('Erreur réseau');
        }
    };

    const handleDeleteUser = async (id, role) => {
        if (role === 'admin') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return toast.error("Impossible de supprimer le dernier administrateur");
            }
        }
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;

        try {
            const res = await fetch(`http://localhost:3001/api/admin/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Utilisateur supprimé');
                fetchAdminData();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Erreur lors de la suppression');
            }
        } catch (e) {
            toast.error('Erreur réseau');
        }
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:3001/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: categoryName })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Catégorie créée');
                setCategoryName('');
                fetchAdminData();
            } else {
                toast.error(data.error || 'Erreur lors de la création');
            }
        } catch (e) {
            toast.error('Erreur réseau');
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!window.confirm("Supprimer cette catégorie ?")) return;
        try {
            const res = await fetch(`http://localhost:3001/api/admin/categories/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Catégorie supprimée');
                fetchAdminData();
            } else {
                toast.error('Erreur lors de la suppression');
            }
        } catch (e) {
            toast.error('Erreur réseau');
        }
    };

    return (
        <div className="dashboard-page">
            <div className="page-header">
                <h1>Tableau de bord</h1>
            </div>

            {user?.role === 'admin' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Users Management */}
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                            <Shield size={20} color="#4f46e5" />
                            <h3 style={{ margin: 0 }}>Gestion des utilisateurs</h3>
                        </div>

                        <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <input
                                className="form-control"
                                type="text"
                                placeholder="Nom"
                                required
                                value={userForm.username}
                                onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                                style={{ flex: 1, minWidth: '40px' }}
                            />
                            <input
                                className="form-control"
                                type="password"
                                placeholder="Mot de passe"
                                required
                                value={userForm.password}
                                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                                style={{ flex: 1, minWidth: '40px' }}
                            />
                            <select
                                className="form-control"
                                value={userForm.role}
                                onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                            >
                                <option value="cashier">Caissier</option>
                                <option value="admin">Admin</option>
                            </select>
                            <button type="submit" className="primary-btn" style={{ padding: '8px 12px' }}>
                                <UserPlus size={16} />
                            </button>
                        </form>

                        {loading ? <p>Chargement...</p> : (
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Utilisateur</th>
                                        <th>Rôle</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.username}</td>
                                            <td>
                                                <span style={{
                                                    background: u.role === 'admin' ? 'rgba(79, 70, 229, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                                    color: u.role === 'admin' ? '#4f46e5' : '#16a34a',
                                                    padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600
                                                }}>{u.role}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {user.username !== u.username && (
                                                    <button className="icon-btn" onClick={() => handleDeleteUser(u.id, u.role)}>
                                                        <Trash2 size={16} color="var(--text-muted)" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Categories Management */}
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                            <FolderPlus size={20} color="#16a34a" />
                            <h3 style={{ margin: 0 }}>Gestion des catégories</h3>
                        </div>

                        <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <input
                                className="form-control"
                                type="text"
                                placeholder="Nouvelle catégorie..."
                                required
                                value={categoryName}
                                onChange={e => setCategoryName(e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <button type="submit" className="primary-btn" style={{ padding: '8px 12px' }}>
                                Ajouter
                            </button>
                        </form>

                        {loading ? <p>Chargement...</p> : (
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Nom</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categories.map(c => (
                                        <tr key={c.id}>
                                            <td>{c.name}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="icon-btn" onClick={() => handleDeleteCategory(c.id)}>
                                                    <Trash2 size={16} color="var(--text-muted)" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {categories.length === 0 && (
                                        <tr><td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune catégorie</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
