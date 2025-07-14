import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, query, where, onSnapshot } from 'firebase/firestore';

// Define Firebase config and app ID from global variables
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('');

    const [supplierName, setSupplierName] = useState('');
    const [supplierCnpj, setSupplierCnpj] = useState('');
    const [supplierAddress, setSupplierAddress] = useState('');
    const [supplierContact, setSupplierContact] = useState('');
    const [supplierLogoFile, setSupplierLogoFile] = useState(null);
    const [supplierNotes, setSupplierNotes] = useState('');

    const [suppliers, setSuppliers] = useState([]);
    const [searchCnpj, setSearchCnpj] = useState('');
    const [foundSupplier, setFoundSupplier] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const initFirebase = async () => {
            try {
                const app = initializeApp(firebaseConfig);
                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestore);
                setAuth(firebaseAuth);

                // Sign in
                if (initialAuthToken) {
                    await signInWithCustomToken(firebaseAuth, initialAuthToken);
                } else {
                    await signInAnonymously(firebaseAuth);
                }

                onAuthStateChanged(firebaseAuth, (user) => {
                    if (user) {
                        setUserId(user.uid);
                        console.log("Firebase initialized and user authenticated:", user.uid);
                    } else {
                        setUserId(null);
                        console.log("No user authenticated.");
                    }
                    setLoading(false);
                });

            } catch (err) {
                console.error("Erro ao inicializar Firebase:", err);
                setError("Erro ao carregar o aplicativo. Tente novamente.");
                setLoading(false);
            }
        };

        initFirebase();
    }, []);

    useEffect(() => {
        if (db && userId) {
            const suppliersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/suppliers`);
            const unsubscribe = onSnapshot(suppliersCollectionRef, (snapshot) => {
                const fetchedSuppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSuppliers(fetchedSuppliers);
            }, (err) => {
                console.error("Erro ao carregar fornecedores em tempo real:", err);
                setError("Erro ao carregar a lista de fornecedores.");
            });

            return () => unsubscribe(); // Cleanup on unmount
        }
    }, [db, userId]);

    const handleAddSupplier = async () => {
        if (!db || !userId) {
            setMessage('Firebase não está pronto. Tente novamente mais tarde.');
            return;
        }

        if (!supplierName || !supplierCnpj) {
            setMessage('Nome e CNPJ do fornecedor são obrigatórios.');
            return;
        }

        setLoading(true);
        setMessage('');
        try {
            let logoUrl = '';
            if (supplierLogoFile) {
                // For simplicity, converting to Data URL. In a real app, use Firebase Storage.
                logoUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(supplierLogoFile);
                });
            }

            const newSupplier = {
                name: supplierName,
                cnpj: supplierCnpj.replace(/[^\d]/g, ''), // Remove non-digits for clean storage
                address: supplierAddress,
                contact: supplierContact,
                logoUrl: logoUrl,
                notes: supplierNotes,
                createdAt: new Date().toISOString(),
            };

            const suppliersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/suppliers`);
            await setDoc(doc(suppliersCollectionRef, newSupplier.cnpj), newSupplier); // Use CNPJ as document ID

            setMessage('Fornecedor cadastrado com sucesso!');
            // Clear form
            setSupplierName('');
            setSupplierCnpj('');
            setSupplierAddress('');
            setSupplierContact('');
            setSupplierLogoFile(null);
            setSupplierNotes('');
            document.getElementById('supplierLogoFile').value = ''; // Clear file input manually

        } catch (err) {
            console.error("Erro ao adicionar fornecedor:", err);
            setError('Erro ao cadastrar fornecedor. Verifique o console para mais detalhes.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSupplier = async () => {
        if (!db || !userId) {
            setMessage('Firebase não está pronto. Tente novamente mais tarde.');
            return;
        }

        if (!searchCnpj) {
            setMessage('Por favor, insira um CNPJ para buscar.');
            setFoundSupplier(null);
            return;
        }

        setIsSearching(true);
        setMessage('');
        setFoundSupplier(null);

        try {
            const cnpjClean = searchCnpj.replace(/[^\d]/g, '');
            const supplierDocRef = doc(db, `artifacts/${appId}/users/${userId}/suppliers`, cnpjClean);
            const docSnap = await getDoc(supplierDocRef);

            if (docSnap.exists()) {
                setFoundSupplier(docSnap.data());
                setMessage('Fornecedor encontrado!');
            } else {
                setMessage('Fornecedor não encontrado para o CNPJ informado.');
            }
        } catch (err) {
            console.error("Erro ao buscar fornecedor:", err);
            setError('Erro ao buscar fornecedor. Verifique o console para mais detalhes.');
        } finally {
            setIsSearching(false);
        }
    };

    const formatCnpj = (value) => {
        value = value.replace(/\D/g, ''); // Remove non-digits
        value = value.replace(/^(\d{2})(\d)/, '$1.$2');
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
        value = value.replace(/(\d{4})(\d)/, '$1-$2');
        return value;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <p className="text-xl text-gray-700">Carregando aplicativo...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-800 p-4 rounded-md">
                <p className="text-xl">{error}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-6 sm:p-8">
                <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">Cadastro de Fornecedores PROVIDEX</h1>
                <p className="text-center text-gray-600 mb-4">ID do Usuário: <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{userId}</span></p>

                {message && (
                    <div className="bg-green-100 text-green-800 p-3 rounded-md mb-4 text-center">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="bg-red-100 text-red-800 p-3 rounded-md mb-4 text-center">
                        {error}
                    </div>
                )}

                {/* Seção de Cadastro de Fornecedores */}
                <div className="mb-8 p-6 border border-blue-200 rounded-lg bg-blue-50">
                    <h2 className="text-2xl font-semibold text-blue-800 mb-4">Cadastrar Novo Fornecedor</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="supplierName" className="block text-sm font-medium text-gray-700">Nome do Fornecedor:</label>
                            <input
                                type="text"
                                id="supplierName"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                                value={supplierName}
                                onChange={(e) => setSupplierName(e.target.value)}
                                placeholder="Nome completo do fornecedor"
                            />
                        </div>
                        <div>
                            <label htmlFor="supplierCnpj" className="block text-sm font-medium text-gray-700">CNPJ:</label>
                            <input
                                type="text"
                                id="supplierCnpj"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                                value={formatCnpj(supplierCnpj)}
                                onChange={(e) => setSupplierCnpj(e.target.value)}
                                placeholder="XX.XXX.XXX/XXXX-XX"
                                maxLength="18"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="supplierAddress" className="block text-sm font-medium text-gray-700">Endereço:</label>
                            <input
                                type="text"
                                id="supplierAddress"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                                value={supplierAddress}
                                onChange={(e) => setSupplierAddress(e.target.value)}
                                placeholder="Rua, Número, Bairro, Cidade - Estado, CEP"
                            />
                        </div>
                        <div>
                            <label htmlFor="supplierContact" className="block text-sm font-medium text-gray-700">Contato (Telefone/E-mail):</label>
                            <input
                                type="text"
                                id="supplierContact"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                                value={supplierContact}
                                onChange={(e) => setSupplierContact(e.target.value)}
                                placeholder="(XX) XXXX-XXXX / email@exemplo.com"
                            />
                        </div>
                        <div>
                            <label htmlFor="supplierLogoFile" className="block text-sm font-medium text-gray-700">Logo do Fornecedor:</label>
                            <input
                                type="file"
                                id="supplierLogoFile"
                                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                accept="image/*"
                                onChange={(e) => setSupplierLogoFile(e.target.files[0])}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="supplierNotes" className="block text-sm font-medium text-gray-700">Observações:</label>
                            <textarea
                                id="supplierNotes"
                                rows="2"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                                value={supplierNotes}
                                onChange={(e) => setSupplierNotes(e.target.value)}
                                placeholder="Notas adicionais sobre o fornecedor"
                            ></textarea>
                        </div>
                    </div>
                    <button
                        onClick={handleAddSupplier}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out"
                        disabled={loading}
                    >
                        {loading ? 'Cadastrando...' : 'Cadastrar Fornecedor'}
                    </button>
                </div>

                {/* Seção de Busca de Fornecedores */}
                <div className="mb-8 p-6 border border-green-200 rounded-lg bg-green-50">
                    <h2 className="text-2xl font-semibold text-green-800 mb-4">Buscar Fornecedor por CNPJ</h2>
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <input
                            type="text"
                            className="flex-grow rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2"
                            value={formatCnpj(searchCnpj)}
                            onChange={(e) => setSearchCnpj(e.target.value)}
                            placeholder="Digite o CNPJ (XX.XXX.XXX/XXXX-XX)"
                            maxLength="18"
                        />
                        <button
                            onClick={handleSearchSupplier}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out sm:w-auto"
                            disabled={isSearching}
                        >
                            {isSearching ? 'Buscando...' : 'Buscar Fornecedor'}
                        </button>
                    </div>

                    {foundSupplier && (
                        <div className="mt-4 p-4 border border-green-300 rounded-md bg-green-100">
                            <h3 className="text-xl font-semibold text-green-900 mb-2">Detalhes do Fornecedor:</h3>
                            <div className="flex items-center mb-2">
                                {foundSupplier.logoUrl && (
                                    <img src={foundSupplier.logoUrl} alt={`${foundSupplier.name} logo`} className="w-12 h-12 rounded-full mr-4 object-cover border border-green-400" />
                                )}
                                <p className="text-lg font-bold">{foundSupplier.name}</p>
                            </div>
                            <p><strong>CNPJ:</strong> {formatCnpj(foundSupplier.cnpj)}</p>
                            <p><strong>Endereço:</strong> {foundSupplier.address || 'N/A'}</p>
                            <p><strong>Contato:</strong> {foundSupplier.contact || 'N/A'}</p>
                            {foundSupplier.notes && <p><strong>Observações:</strong> {foundSupplier.notes}</p>}
                        </div>
                    )}
                </div>

                {/* Lista de Todos os Fornecedores Cadastrados */}
                <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Todos os Fornecedores Cadastrados</h2>
                    {suppliers.length === 0 ? (
                        <p className="text-gray-500 text-center">Nenhum fornecedor cadastrado ainda.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white rounded-md shadow-sm">
                                <thead>
                                    <tr>
                                        <th className="py-2 px-4 border-b border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Logo</th>
                                        <th className="py-2 px-4 border-b border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nome</th>
                                        <th className="py-2 px-4 border-b border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CNPJ</th>
                                        <th className="py-2 px-4 border-b border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contato</th>
                                        <th className="py-2 px-4 border-b border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Endereço</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map((supplier) => (
                                        <tr key={supplier.id} className="hover:bg-gray-50">
                                            <td className="py-2 px-4 border-b border-gray-200">
                                                {supplier.logoUrl ? (
                                                    <img src={supplier.logoUrl} alt={`${supplier.name} logo`} className="w-8 h-8 rounded-full object-cover border border-gray-300" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">?</div>
                                                )}
                                            </td>
                                            <td className="py-2 px-4 border-b border-gray-200">{supplier.name}</td>
                                            <td className="py-2 px-4 border-b border-gray-200">{formatCnpj(supplier.cnpj)}</td>
                                            <td className="py-2 px-4 border-b border-gray-200">{supplier.contact || 'N/A'}</td>
                                            <td className="py-2 px-4 border-b border-gray-200">{supplier.address || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
