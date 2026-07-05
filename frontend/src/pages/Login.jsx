import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { Lock, User } from 'lucide-react';
import './Login.css';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const result = await login(username, password);
        setIsSubmitting(false);

        if (result.success) {
            toast.success('Connexion réussie !');
            navigate('/');
        } else {
            toast.error(result.error || 'Identifiants invalides');
        }
    };

    return (
        <div className="login-container">
            <Toaster position="top-center" />
            <div className="login-card">
                <div className="login-header">
                    <div className="logo-placeholder"></div>
                    <h2>Retail Shop OS</h2>
                    <p>Veuillez vous connecter à votre compte</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <User className="input-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Nom d'utilisateur"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <Lock className="input-icon" size={20} />
                        <input
                            type="password"
                            placeholder="Mot de passe"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" disabled={isSubmitting} className="login-button">
                        {isSubmitting ? 'Authentification...' : 'Se connecter'}
                    </button>
                </form>
            </div>
        </div>
    );
}
