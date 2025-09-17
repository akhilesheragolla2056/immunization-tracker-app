import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Baby, Stethoscope, ShieldCheck, LogOut, PlusCircle, ArrowLeft, BookOpen, X, Users, BarChart2, Bell } from 'lucide-react';

// --- Firebase Configuration ---
// IMPORTANT: This configuration is provided by the environment.
// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};


const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-immunization-app';

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Authentication Context ---
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        let roleUnsubscribe = () => {};

        const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            roleUnsubscribe(); // Unsubscribe from any previous role listener

            if (firebaseUser) {
                // If user is signed in, listen for their role document.
                const userDocRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}`);
                roleUnsubscribe = onSnapshot(userDocRef, (doc) => {
                    setUserRole(doc.exists() ? doc.data().role : null);
                    setLoading(false);
                }, (error) => {
                    console.error("Error listening to user role:", error);
                    setUserRole(null);
                    setLoading(false);
                });
            } else {
                // If user is null (logged out), clear the role and stop loading.
                setUserRole(null);
                setLoading(false);
            }
        });

        // Cleanup function for the effect
        return () => {
            authUnsubscribe();
            roleUnsubscribe();
        };
    }, []);

    const logout = () => {
        signOut(auth);
    };

    const value = { user, loading, userRole, setUserRole, logout };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


// --- Vaccine Data and Schedule Logic ---
const VACCINE_SCHEDULE = [
    { name: "BCG", due: 0, gap: 0, info: "Protects against tuberculosis." },
    { name: "Hepatitis B - Birth Dose", due: 0, gap: 0, info: "Protects against Hepatitis B virus infection." },
    { name: "OPV - 0", due: 0, gap: 0, info: "Protects against Polio virus." },
    { name: "Pentavalent - 1", due: 42, gap: 28, info: "Combination vaccine for Diphtheria, Tetanus, Pertussis, Hib, and Hep B." },
    { name: "OPV - 1", due: 42, gap: 28, info: "First dose of oral polio vaccine." },
    { name: "Rotavirus - 1", due: 42, gap: 28, info: "Protects against rotavirus infections, a common cause of diarrhea." },
    { name: "PCV - 1", due: 42, gap: 28, info: "Protects against pneumococcal disease." },
    { name: "Pentavalent - 2", due: 70, gap: 28, info: "Second dose of Pentavalent." },
    { name: "OPV - 2", due: 70, gap: 28, info: "Second dose of oral polio vaccine." },
    { name: "Rotavirus - 2", due: 70, gap: 28, info: "Second dose of rotavirus vaccine." },

    { name: "Pentavalent - 3", due: 98, gap: 0, info: "Third dose of Pentavalent." },
    { name: "OPV - 3", due: 98, gap: 0, info: "Third dose of oral polio vaccine." },
    { name: "Rotavirus - 3", due: 98, gap: 0, info: "Third dose of rotavirus vaccine." },
    { name: "PCV - Booster 1", due: 98, gap: 0, info: "First booster for pneumococcal vaccine." },

    { name: "MMR - 1", due: 270, gap: 0, info: "Protects against Measles, Mumps, and Rubella." },
    { name: "Vitamin A - 1", due: 270, gap: 0, info: "First dose of Vitamin A supplement." },

    { name: "DPT - Booster 1", due: 480, gap: 0, info: "Booster for Diphtheria, Pertussis, and Tetanus." },
    { name: "OPV - Booster", due: 480, gap: 0, info: "Booster dose for Polio." },
    { name: "MMR - 2", due: 480, gap: 0, info: "Second dose for Measles, Mumps, and Rubella." },
    { name: "Vitamin A - 2", due: 480, gap: 180, info: "Second dose of Vitamin A, then every 6 months." },

    { name: "Td-TT", due: 3650, gap: 0, info: "Tetanus and adult Diphtheria booster (10 years)." },
];

const generateSchedule = (dob) => {
    const birthDate = new Date(dob);
    return VACCINE_SCHEDULE.map(vaccine => {
        const dueDate = new Date(birthDate);
        dueDate.setDate(dueDate.getDate() + vaccine.due);
        return {
            ...vaccine,
            dueDate: dueDate.toISOString().split('T')[0],
            status: 'Due',
            givenDate: null,
        };
    });
};

// --- UI Components ---

const Spinner = () => (
    <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
    </div>
);

const EducationalModal = ({ setShowModal }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative">
                <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
                    <X size={24} />
                </button>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <BookOpen className="mr-3 text-blue-500" /> Vaccine Information
                </h2>
                <div className="space-y-4">
                    {VACCINE_SCHEDULE.map((vaccine, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-700">{vaccine.name}</h3>
                            <p className="text-gray-600">{vaccine.info}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const AddChildModal = ({ setShowModal, parentId }) => {
    const [childName, setChildName] = useState('');
    const [dob, setDob] = useState('');
    const [parentName, setParentName] = useState('');
    const [contact, setContact] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!childName || !dob || !parentName || !contact) {
            setError('Please fill in all fields.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const childrenCollectionRef = collection(db, `artifacts/${appId}/public/data/children`);
            const childDoc = await addDoc(childrenCollectionRef, {
                name: childName,
                dob,
                parentId,
                parentName,
                contact,
            });

            const schedule = generateSchedule(dob);
            const scheduleCollectionRef = collection(db, `artifacts/${appId}/public/data/children/${childDoc.id}/vaccinations`);
            
            const batchPromises = schedule.map(vaccine => {
                const vaccineDocRef = doc(scheduleCollectionRef, vaccine.name);
                return setDoc(vaccineDocRef, vaccine);
            });
            await Promise.all(batchPromises);

            setShowModal(false);
        } catch (err) {
            console.error("Error adding child: ", err);
            setError('Failed to add child. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
                <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
                    <X size={24} />
                </button>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Add a New Child</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="childName" className="block text-sm font-medium text-gray-700">Child's Full Name</label>
                        <input type="text" id="childName" value={childName} onChange={(e) => setChildName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="dob" className="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <input type="date" id="dob" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="parentName" className="block text-sm font-medium text-gray-700">Parent/Guardian Name</label>
                        <input type="text" id="parentName" value={parentName} onChange={(e) => setParentName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                     <div>
                        <label htmlFor="contact" className="block text-sm font-medium text-gray-700">Contact Number</label>
                        <input type="text" id="contact" value={contact} onChange={(e) => setContact(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div className="pt-2">
                        <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300">
                            {loading ? <Spinner /> : 'Add Child'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const VaccineScheduleView = ({ child, setSelectedChild }) => {
    const [vaccinations, setVaccinations] = useState([]);
    const [loading, setLoading] = useState(true);
    const { userRole } = useAuth();

    useEffect(() => {
        const scheduleCollectionRef = collection(db, `artifacts/${appId}/public/data/children/${child.id}/vaccinations`);
        const q = query(scheduleCollectionRef);
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const scheduleData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by due date
            scheduleData.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
            setVaccinations(scheduleData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching schedule: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [child.id]);

    const handleStatusUpdate = async (vaccineName, newStatus) => {
        const vaccineDocRef = doc(db, `artifacts/${appId}/public/data/children/${child.id}/vaccinations`, vaccineName);
        try {
            await updateDoc(vaccineDocRef, {
                status: newStatus,
                givenDate: newStatus === 'Done' ? new Date().toISOString().split('T')[0] : null
            });
        } catch (error) {
            console.error("Error updating vaccine status: ", error);
        }
    };
    
    const getStatusChip = (vaccine) => {
        const today = new Date().setHours(0, 0, 0, 0);
        const dueDate = new Date(vaccine.dueDate).setHours(0, 0, 0, 0);

        if (vaccine.status === 'Done') return 'bg-green-100 text-green-800';
        if (vaccine.status === 'Due' && today > dueDate) return 'bg-red-100 text-red-800';
        if (vaccine.status === 'Due') return 'bg-yellow-100 text-yellow-800';
        return 'bg-gray-100 text-gray-800';
    };

    const getStatusText = (vaccine) => {
        const today = new Date().setHours(0, 0, 0, 0);
        const dueDate = new Date(vaccine.dueDate).setHours(0, 0, 0, 0);

        if (vaccine.status === 'Done') return 'Done';
        if (vaccine.status === 'Due' && today > dueDate) return 'Missed';
        return 'Due';
    };

    if (loading) return <Spinner />;

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
            <button onClick={() => setSelectedChild(null)} className="flex items-center text-blue-600 font-medium mb-6 hover:underline">
                <ArrowLeft size={20} className="mr-2" /> Back to Children List
            </button>
            <div className="bg-white p-6 rounded-2xl shadow-lg mb-6">
                <h2 className="text-3xl font-bold text-gray-800">{child.name}</h2>
                <p className="text-gray-500">Date of Birth: {new Date(child.dob).toLocaleDateString()}</p>
                <p className="text-gray-500 mt-1">Guardian: {child.parentName} ({child.contact})</p>
            </div>
            
            <div className="space-y-3">
                {vaccinations.map(vaccine => (
                    <div key={vaccine.id} className="bg-white rounded-xl shadow-md p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div className="flex-1 mb-4 sm:mb-0">
                            <h3 className="font-bold text-lg text-gray-800">{vaccine.name}</h3>
                            <p className="text-sm text-gray-500">Due on: {new Date(vaccine.dueDate).toLocaleDateString()}</p>
                            {vaccine.givenDate && <p className="text-sm text-green-600">Given on: {new Date(vaccine.givenDate).toLocaleDateString()}</p>}
                        </div>
                        <div className="flex items-center space-x-2 w-full sm:w-auto">
                           <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusChip(vaccine)}`}>
                                {getStatusText(vaccine)}
                           </span>
                           {userRole === 'healthcare_worker' && vaccine.status !== 'Done' && (
                                <button 
                                    onClick={() => handleStatusUpdate(vaccine.id, 'Done')}
                                    className="px-3 py-1 text-sm font-medium text-white bg-green-500 rounded-full hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                                >
                                    Mark as Done
                                </button>
                           )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ParentDashboard = ({ user }) => {
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedChild, setSelectedChild] = useState(null);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, `artifacts/${appId}/public/data/children`), where("parentId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const childrenData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setChildren(childrenData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching children: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);
    
    useEffect(() => {
        if (!user || children.length === 0) return;

        const checkAndCreateNotifications = async () => {
            const today = new Date();
            const oneWeekFromNow = new Date();
            oneWeekFromNow.setDate(today.getDate() + 7);

            for (const child of children) {
                const scheduleCollectionRef = collection(db, `artifacts/${appId}/public/data/children/${child.id}/vaccinations`);
                const scheduleSnapshot = await getDocs(scheduleCollectionRef);
                
                for (const docSnap of scheduleSnapshot.docs) {
                    const vaccine = docSnap.data();
                    const dueDate = new Date(vaccine.dueDate);

                    // Check for missed vaccines
                    if (vaccine.status === 'Due' && dueDate < today) {
                        const notificationId = `missed-${child.id}-${vaccine.name}`;
                        const notificationRef = doc(db, `artifacts/${appId}/users/${user.uid}/notifications`, notificationId);
                        const notificationDoc = await getDocs(query(collection(db, `artifacts/${appId}/users/${user.uid}/notifications`), where("id", "==", notificationId)));

                        if (notificationDoc.empty) {
                            await setDoc(notificationRef, {
                                id: notificationId,
                                childName: child.name,
                                vaccineName: vaccine.name,
                                dueDate: vaccine.dueDate,
                                message: `ACTION REQUIRED: ${child.name}'s ${vaccine.name} vaccine was due on ${new Date(vaccine.dueDate).toLocaleDateString()}.`,
                                read: false,
                                createdAt: serverTimestamp()
                            });
                        }
                    }

                    // Check for upcoming vaccines
                    if (vaccine.status === 'Due' && dueDate >= today && dueDate <= oneWeekFromNow) {
                        const notificationId = `upcoming-${child.id}-${vaccine.name}`;
                        const notificationRef = doc(db, `artifacts/${appId}/users/${user.uid}/notifications`, notificationId);
                        const notificationDoc = await getDocs(query(collection(db, `artifacts/${appId}/users/${user.uid}/notifications`), where("id", "==", notificationId)));
                        
                        if (notificationDoc.empty) {
                             await setDoc(notificationRef, {
                                id: notificationId,
                                childName: child.name,
                                vaccineName: vaccine.name,
                                dueDate: vaccine.dueDate,
                                message: `REMINDER: ${child.name}'s ${vaccine.name} vaccine is due on ${new Date(vaccine.dueDate).toLocaleDateString()}.`,
                                read: false,
                                createdAt: serverTimestamp()
                            });
                        }
                    }
                }
            }
        };

        checkAndCreateNotifications();
    }, [children, user]);


    if (loading) return <Spinner />;
    if (selectedChild) return <VaccineScheduleView child={selectedChild} setSelectedChild={setSelectedChild} />;

    return (
        <div className="p-4 sm:p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">My Children</h1>
            {children.length === 0 ? (
                <div className="text-center py-10 px-6 bg-white rounded-2xl shadow-md">
                    <Baby size={48} className="mx-auto text-gray-400" />
                    <p className="mt-4 text-gray-600">You haven't added any children yet.</p>
                    <button onClick={() => setShowAddModal(true)} className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <PlusCircle className="mr-2 -ml-1" /> Add Your First Child
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {children.map(child => (
                        <div key={child.id} onClick={() => setSelectedChild(child)} className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-center space-x-4">
                                <div className="bg-blue-100 p-3 rounded-full">
                                    <Baby size={24} className="text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">{child.name}</h3>
                                    <p className="text-gray-500">DOB: {new Date(child.dob).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => setShowAddModal(true)} className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:bg-gray-100 hover:border-blue-400 hover:text-blue-600 transition-all duration-300">
                        <PlusCircle size={32} />
                        <span className="mt-2 font-semibold">Add Another Child</span>
                    </button>
                </div>
            )}
            {showAddModal && <AddChildModal setShowModal={setShowAddModal} parentId={user.uid} />}
        </div>
    );
};

const HealthcareDashboard = ({ user }) => {
    const [allChildren, setAllChildren] = useState([]);
    const [filteredChildren, setFilteredChildren] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedChild, setSelectedChild] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showReports, setShowReports] = useState(false);

    useEffect(() => {
        if (!user) return;
        
        const q = query(collection(db, `artifacts/${appId}/public/data/children`));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const childrenData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllChildren(childrenData);
            setFilteredChildren(childrenData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching all children: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const results = allChildren.filter(child =>
            child.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredChildren(results);
    }, [searchTerm, allChildren]);

    if (loading) return <Spinner />;
    if (selectedChild) return <VaccineScheduleView child={selectedChild} setSelectedChild={setSelectedChild} />;
    if (showReports) return <ReportsView allChildren={allChildren} setShowReports={setShowReports} />;

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-4 sm:mb-0">All Children</h1>
                <button onClick={() => setShowReports(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <BarChart2 className="mr-2" size={18} /> View Reports
                </button>
            </div>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search by child's name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            {filteredChildren.length === 0 ? (
                <div className="text-center py-10 px-6 bg-white rounded-2xl shadow-md">
                    <Users size={48} className="mx-auto text-gray-400" />
                    <p className="mt-4 text-gray-600">No children found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredChildren.map(child => (
                        <div key={child.id} onClick={() => setSelectedChild(child)} className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-center space-x-4">
                                <div className="bg-green-100 p-3 rounded-full">
                                    <Baby size={24} className="text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">{child.name}</h3>
                                    <p className="text-gray-500">DOB: {new Date(child.dob).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ReportsView = ({ allChildren, setShowReports }) => {
    const [vaccineStats, setVaccineStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [ageFilter, setAgeFilter] = useState('all');

    const calculateAgeInMonths = (dob) => {
        const birthDate = new Date(dob);
        const today = new Date();
        let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
        months -= birthDate.getMonth();
        months += today.getMonth();
        return months <= 0 ? 0 : months;
    };

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            const stats = {};
            for (const vaccine of VACCINE_SCHEDULE) {
                stats[vaccine.name] = { due: 0, done: 0, total: 0 };
            }

            const filteredChildren = allChildren.filter(child => {
                if (ageFilter === 'all') return true;
                const ageInMonths = calculateAgeInMonths(child.dob);
                if (ageFilter === '0-6') return ageInMonths <= 6;
                if (ageFilter === '7-12') return ageInMonths > 6 && ageInMonths <= 12;
                if (ageFilter === '13-60') return ageInMonths > 12 && ageInMonths <= 60;
                return true;
            });

            const promises = filteredChildren.map(async (child) => {
                const scheduleCollectionRef = collection(db, `artifacts/${appId}/public/data/children/${child.id}/vaccinations`);
                const q = query(scheduleCollectionRef);
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (stats[data.name]) {
                        stats[data.name].total++;
                        if (data.status === 'Done') {
                            stats[data.name].done++;
                        } else {
                            stats[data.name].due++;
                        }
                    }
                });
            });

            await Promise.all(promises);
            setVaccineStats(stats);
            setLoading(false);
        };

        fetchStats();
    }, [allChildren, ageFilter]);

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
            <button onClick={() => setShowReports(false)} className="flex items-center text-blue-600 font-medium mb-6 hover:underline">
                <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
            </button>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Vaccination Coverage Report</h1>
                <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} className="p-2 border border-gray-300 rounded-md">
                    <option value="all">All Ages</option>
                    <option value="0-6">0-6 Months</option>
                    <option value="7-12">7-12 Months</option>
                    <option value="13-60">1-5 Years</option>
                </select>
            </div>
             {loading ? <Spinner/> : (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="space-y-4">
                        {Object.entries(vaccineStats).map(([name, data]) => {
                            const coverage = data.total > 0 ? ((data.done / data.total) * 100).toFixed(1) : 0;
                            const coverageColor = coverage >= 80 ? 'bg-green-500' : coverage >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                            return (
                                <div key={name}>
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-semibold text-gray-700">{name}</h3>
                                        <span className="text-sm font-medium text-gray-600">{data.done} / {data.total} ({coverage}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div className={`${coverageColor} h-2.5 rounded-full`} style={{ width: `${coverage}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
             )}
        </div>
    );
};


const RoleSelectionScreen = ({ onSelectRole }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center items-center p-4">
            <div className="text-center mb-12">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-800">Welcome to ImmunoTrack</h1>
                <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">Your digital partner in ensuring a healthy future for every child.</p>
            </div>
            <div className="w-full max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-center text-gray-700 mb-8">Please select your role to continue:</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div onClick={() => onSelectRole('parent')} className="bg-white rounded-2xl shadow-lg p-8 text-center cursor-pointer transform hover:scale-105 transition-transform duration-300">
                        <Baby size={64} className="mx-auto text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800">Parent / Guardian</h3>
                        <p className="mt-2 text-gray-500">Track your child's vaccination schedule with ease.</p>
                    </div>
                    <div onClick={() => onSelectRole('healthcare_worker')} className="bg-white rounded-2xl shadow-lg p-8 text-center cursor-pointer transform hover:scale-105 transition-transform duration-300">
                        <Stethoscope size={64} className="mx-auto text-green-500 mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800">Healthcare Worker</h3>
                        <p className="mt-2 text-gray-500">Manage records and monitor vaccination coverage.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AppHeader = () => {
    const { user, logout } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [showEduModal, setShowEduModal] = useState(false);

    useEffect(() => {
        if (user) {
            const notificationsRef = collection(db, `artifacts/${appId}/users/${user.uid}/notifications`);
            const q = query(notificationsRef);
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                notifs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setNotifications(notifs);
            });
            return () => unsubscribe();
        }
    }, [user]);

    const markAsRead = async (notificationId) => {
        if (user) {
            const notifRef = doc(db, `artifacts/${appId}/users/${user.uid}/notifications`, notificationId);
            await updateDoc(notifRef, { read: true });
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <>
            <header className="bg-white shadow-md sticky top-0 z-30">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center">
                        <ShieldCheck className="text-blue-600" size={32} />
                        <h1 className="text-xl font-bold text-gray-800 ml-2">ImmunoTrack</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={() => setShowEduModal(true)} className="flex items-center text-gray-600 hover:text-blue-600 transition-colors">
                            <BookOpen size={20} className="mr-1" />
                            <span className="hidden sm:inline">Vaccine Info</span>
                        </button>
                        <div className="relative">
                            <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="flex items-center text-gray-600 hover:text-blue-600 transition-colors relative">
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadCount}</span>
                                )}
                            </button>
                            {isPanelOpen && (
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50 border border-gray-200">
                                    <div className="p-4 font-bold border-b">Notifications</div>
                                    <div className="max-h-96 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <p className="text-gray-500 p-4">No notifications yet.</p>
                                        ) : (
                                            notifications.map(notif => (
                                                <div key={notif.id} onClick={() => markAsRead(notif.id)} className={`p-4 border-b hover:bg-gray-100 cursor-pointer ${!notif.read ? 'bg-blue-50' : ''}`}>
                                                    <p className={`font-semibold ${notif.message.includes('ACTION REQUIRED') ? 'text-red-600' : 'text-blue-600'}`}>{notif.vaccineName} Alert</p>
                                                    <p className="text-sm text-gray-600">{notif.message}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={logout} className="flex items-center text-red-500 hover:text-red-700 transition-colors">
                            <LogOut size={20} className="mr-1" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>
            {showEduModal && <EducationalModal setShowModal={setShowEduModal} />}
        </>
    );
};

// --- Main App Component ---
function App() {
    const { user, loading, userRole, setUserRole } = useAuth();
    
    const handleRoleSelect = async (role) => {
        try {
            let currentUser = auth.currentUser;
            if (!currentUser) {
                 const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                 if (token) {
                    const userCredential = await signInWithCustomToken(auth, token);
                    currentUser = userCredential.user;
                } else {
                    const userCredential = await signInAnonymously(auth);
                    currentUser = userCredential.user;
                }
            }
            const userDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}`);
            await setDoc(userDocRef, { role });
            setUserRole(role);
        } catch (error) {
            console.error("Error selecting role: ", error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex justify-center items-center">
                <Spinner />
            </div>
        );
    }

    if (!user || !userRole) {
        return <RoleSelectionScreen onSelectRole={handleRoleSelect} />;
    }
    
    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <AppHeader />
            <main className="container mx-auto">
                {userRole === 'parent' && <ParentDashboard user={user} />}
                {userRole === 'healthcare_worker' && <HealthcareDashboard user={user} />}
            </main>
        </div>
    );
}

export default function Root() {
    return (
        <AuthProvider>
            <App />
        </AuthProvider>
    );
}
