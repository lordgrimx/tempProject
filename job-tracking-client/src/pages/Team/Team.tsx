import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppDispatch, RootState } from '../../redux/store';
import UserTaskCommentModal from '../../components/Comments/UserTaskCommentModal';
import { IoIosAddCircleOutline } from "react-icons/io";
import {
    fetchTeamMembers,
    fetchDepartments,
    setSearchQuery,
    createTeam,
    generateTeamInviteLink,
    fetchTeams,
    deleteTeam,
    removeTeamMember,
    getTeamInviteLink,
    setTeamInviteLink,
    addExperties,
    fetchMemberActiveTasks,
    joinTeamWithInviteCode
} from '../../redux/features/teamSlice';
import { useTheme } from '../../context/ThemeContext';
import { TeamMember } from '../../types/team';
import {
    ChatBubbleLeftIcon,
    ClipboardDocumentListIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    ClipboardDocumentIcon,
    UserMinusIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../services/axiosInstance';
import { useSnackbar } from 'notistack';
import { DEPARTMENTS } from '../../constants/departments';
import TaskForm from '../../components/TaskForm/TaskForm';
import { createTask, Task } from '../../redux/features/tasksSlice';
import Footer from '../../components/Footer/Footer';
import { toast } from 'react-hot-toast';

const Team: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const location = useLocation();
    const { isDarkMode } = useTheme();
    const { enqueueSnackbar } = useSnackbar();
    const {
        teams,
        searchQuery,
        filters,
        sortBy,
        sortOrder
    } = useSelector((state: RootState) => state.team);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
    const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [teamDescription, setTeamDescription] = useState('');
    const [teamDepartment, setTeamDepartment] = useState('');
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [creatingTeam, setCreatingTeam] = useState(false);
    const [inviteLink, setInviteLink] = useState('');
    const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
    const [inviteLinkDialogOpen, setInviteLinkDialogOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [joinTeamDialogOpen, setJoinTeamDialogOpen] = useState(false);
    const [joiningTeam, setJoiningTeam] = useState(false);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [currentTeamId, setCurrentTeamId] = useState('');
    const [currentMemberId, setCurrentMemberId] = useState('');
    const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
    const [removingMember, setRemovingMember] = useState(false);
    const [addingExpertise, setAddingExpertise] = useState(false);
    const [addExpertiseDialogOpen, setAddExpertiseDialogOpen] = useState(false);
    const [expertise, setExpertise] = useState('');
    const [selectedMemberForTask, setSelectedMemberForTask] = useState<TeamMember | null>(null);
    const [selectedTeamForTask, setSelectedTeamForTask] = useState<{ id: string; name: string } | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [showExpertiesModal, setShowExpertiesModal] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');
    const [newExpertise, setNewExpertise] = useState('');
    const [newTeamDepartment, setNewTeamDepartment] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [teamToDelete, setTeamToDelete] = useState<string>('');
    const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<{ teamId: string, memberId: string } | null>(null);
    const currentUser = useSelector((state: RootState) => state.auth.user);
    const [showCommentModal, setShowCommentModal] = useState(false);

    useEffect(() => {
        // Kullanıcı girişi kontrolü
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/auth');
            return;
        }

        dispatch(fetchTeamMembers());
        dispatch(fetchDepartments());
        dispatch(fetchTeams());
    }, [dispatch, navigate]);

    // Teams listesini periyodik olarak güncelle
    useEffect(() => {
        // İlk yükleme
        dispatch(fetchTeams());
        dispatch(fetchMemberActiveTasks());
        
        // Her 15 saniyede bir güncelle
        const interval = setInterval(() => {
            dispatch(fetchTeams());
            dispatch(fetchMemberActiveTasks());
        }, 15000);
        
        return () => clearInterval(interval);
    }, [dispatch]);

    const handleCreateTeam = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/auth');
            return;
        }

        if (teamName.trim() && teamDepartment) {
            try {
                console.log('Takım oluşturma isteği gönderiliyor:', {
                    name: teamName,
                    description: teamDescription.trim() || undefined,
                    department: teamDepartment
                });

                const result = await dispatch(createTeam({
                    name: teamName,
                    description: teamDescription.trim() || undefined,
                    department: teamDepartment
                }) as any);

                console.log('API Yanıtı:', result); // Debug için

                if (result.error) {
                    const errorMessage = result.error.response?.data?.message || result.error.message || 'Ekip oluşturulurken bir hata oluştu';
                    console.error('Hata detayı:', result.error); // Debug için
                    enqueueSnackbar(errorMessage, { variant: 'error' });
                    return;
                }

                if (result.payload) {
                    try {
                        const linkResult = await dispatch(generateTeamInviteLink(result.payload.id) as any);
                        if (linkResult.error) {
                            // 401 hatası için özel kontrol
                            if (linkResult.error.response?.status === 401) {
                                navigate('/auth');
                                return;
                            }
                            throw new Error(linkResult.error.message || 'Davet linki oluşturulurken bir hata oluştu');
                        }

                        if (linkResult.payload) {
                            setInviteLink(linkResult.payload.inviteLink);
                            enqueueSnackbar('Ekip başarıyla oluşturuldu!', { variant: 'success' });
                            setShowCreateTeamModal(false);
                            setTeamName('');
                            setTeamDescription('');
                            setTeamDepartment('');
                            dispatch(fetchTeams());
                        }
                    } catch (error: any) {
                        enqueueSnackbar(error.message, { variant: 'error' });
                    }
                }
            } catch (error: any) {
                enqueueSnackbar(error.message, { variant: 'error' });
                setShowCreateTeamModal(true);
            }
        } else {
            enqueueSnackbar('Takım adı ve departman seçimi zorunludur', { variant: 'error' });
        }
    };

    const handleGenerateInviteLink = async (teamId: string) => {
        try {
            setInviteLinkLoading(true);
            // Yeni eklenen redux aksiyonunu kullan
            const result = await dispatch(generateTeamInviteLink(teamId)).unwrap();
            setInviteLink(result.inviteLink);
            setInviteLinkDialogOpen(true);
            setInviteLinkLoading(false);
        } catch (error) {
            console.error('Davet linki oluşturma hatası:', error);
            toast.error('Davet linki oluşturulurken bir hata oluştu.');
            setInviteLinkLoading(false);
        }
    };

    const handleCopyInviteLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (error: any) {
            console.error('Link kopyalanırken hata oluştu:', error);
        }
    };

    const handleDeleteTeamClick = (teamId: string) => {
        setTeamToDelete(teamId);
        setShowDeleteConfirmModal(true);
    };

    const handleDeleteTeam = async () => {
        if (!teamToDelete) return;

        try {
            await dispatch(deleteTeam(teamToDelete)).unwrap();
            enqueueSnackbar('Takım başarıyla silindi', { variant: 'success' });
            setShowDeleteConfirmModal(false);
            setTeamToDelete('');

            // Ana sayfaya yönlendir
            navigate('/');
        } catch (error: any) {
            enqueueSnackbar(error.message || 'Takım silinirken bir hata oluştu', { variant: 'error' });
        }
    };

    const handleRemoveMemberClick = (teamId: string, memberId: string) => {
        setMemberToRemove({ teamId, memberId });
        setShowRemoveMemberModal(true);
    };

    const handleRemoveMember = async () => {
        if (!currentTeamId || !currentMemberId) return;
        
        try {
            setRemovingMember(true);
            // Yeni eklenen redux aksiyonunu kullan
            const result = await dispatch(removeTeamMember({ 
                teamId: currentTeamId, 
                memberId: currentMemberId 
            })).unwrap();
            
            if (result.success) {
                toast.success(result.message || 'Üye başarıyla çıkarıldı.');
                setRemoveMemberDialogOpen(false);
                // Takımları yeniden yükle
                dispatch(fetchTeams());
            } else {
                toast.error(result.message || 'Üye çıkarılırken bir hata oluştu.');
            }
            setRemovingMember(false);
        } catch (error) {
            console.error('Üye çıkarma hatası:', error);
            toast.error('Üye çıkarılırken bir hata oluştu.');
            setRemovingMember(false);
        }
    };

    const handleCommentClick = (userId: string) => {
        setSelectedUserId(userId);
        setShowCommentModal(true);
    };

    const handleAddExpertise = async () => {
        if (!expertise || !currentMemberId) {
            toast.error('Lütfen bir uzmanlık alanı girin.');
            return;
        }
        
        try {
            setAddingExpertise(true);
            // Yeni eklenen redux aksiyonunu kullan
            await dispatch(addExperties({ 
                memberId: currentMemberId, 
                experties: expertise 
            })).unwrap();
            
            toast.success('Uzmanlık alanı başarıyla eklendi.');
            setAddExpertiseDialogOpen(false);
            setExpertise('');
            // Üyeleri yeniden yükle
            dispatch(fetchTeamMembers());
            setAddingExpertise(false);
        } catch (error) {
            console.error('Uzmanlık alanı ekleme hatası:', error);
            toast.error('Uzmanlık alanı eklenirken bir hata oluştu.');
            setAddingExpertise(false);
        }
    };

    const handleAddExpertiseClick = (id: string) => {
        setSelectedMemberId(id);
        setShowExpertiesModal(true);
    };

    const handleOpenTaskForm = (member: TeamMember, teamId: string, teamName: string) => {
        setSelectedMemberForTask(member);
        // Pass team info including id and name to TaskForm component
        setSelectedTeamForTask({
            id: teamId,
            name: teamName
        });
        setShowTaskForm(true);
    };

    const handleCreateTask = async (taskData: Omit<Task, 'id'>) => {
        try {
            await dispatch(createTask(taskData)).unwrap();
            enqueueSnackbar('Görev başarıyla oluşturuldu', { variant: 'success' });
            setShowTaskForm(false);
        } catch (error: any) {
            enqueueSnackbar(error.message || 'Görev oluşturulurken bir hata oluştu', { variant: 'error' });
        }
    };

    const handleJoinTeamWithInviteCode = async () => {
        if (!inviteCode) {
            toast.error('Lütfen bir davet kodu girin.');
            return;
        }
        
        try {
            setJoiningTeam(true);
            // Yeni eklenen redux aksiyonunu kullan
            await dispatch(joinTeamWithInviteCode(inviteCode)).unwrap();
            toast.success('Takıma başarıyla katıldınız!');
            setJoinTeamDialogOpen(false);
            setInviteCode('');
            // Takımları yeniden yükle
            dispatch(fetchTeams());
            setJoiningTeam(false);
        } catch (error) {
            console.error('Takıma katılma hatası:', error);
            toast.error('Takıma katılırken bir hata oluştu. Davet kodunu kontrol edin.');
            setJoiningTeam(false);
        }
    };

    const renderTeamMembers = (teamMembers: TeamMember[], teamName: string, teamId: string) => {
        const filteredAndSortedMembers = teamMembers
            .filter(member => {
                const matchesSearch = member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    member.email.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesStatus = filters.status.length === 0 || filters.status.includes(member.status);
                const matchesDepartment = filters.department.length === 0 || filters.department.includes(member.department);
                const matchesExpertise = filters.expertise.length === 0 || 
                    member.expertise?.some(exp => filters.expertise.includes(exp));
                return matchesSearch && matchesStatus && matchesDepartment && matchesExpertise;
            })
            .sort((a, b) => {
                if (sortBy === 'performance') {
                    const aScore = typeof a.performanceScore === 'number' ? a.performanceScore : 0;
                    const bScore = typeof b.performanceScore === 'number' ? b.performanceScore : 0;
                    return sortOrder === 'asc' ? aScore - bScore : bScore - aScore;
                }
                // ...existing sorting logic...
                return 0;
            });

        // İşlemi yapan kullanıcının bu takımın owner'ı olup olmadığını kontrol et
        const isTeamOwner = teamMembers.some(member => 
            member.id === currentUser?.id && member.role === 'Owner'
        );

        return (
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{teamName}</h2>
                    <div className="flex gap-2">
                        {teamMembers.some(member => member.role === 'Owner' && member.id === currentUser?.id) && (
                            <button
                                onClick={() => handleGenerateInviteLink(teamId)}
                                className={`flex items-center px-3 py-1 rounded-lg ${isDarkMode
                                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    }`}
                            >
                                <ClipboardDocumentIcon className="h-5 w-5 mr-2" />
                                Davet Linki
                            </button>)}
                        {teamMembers.some(member => member.role === 'Owner' && member.id === currentUser?.id) && (
                            <button
                                onClick={() => handleDeleteTeamClick(teamId)}
                                className={`flex items-center px-3 py-1 rounded-lg ${isDarkMode
                                    ? 'bg-red-900 hover:bg-red-800 text-red-100'
                                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                                    }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Takımı Sil
                            </button>
                        )}
                    </div>
                </div>
                <div className={`shadow-lg rounded-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <div className="overflow-x-auto">
                        <table className={`min-w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                            <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                                <tr>
                                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Üye
                                    </th>
                                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Departman
                                    </th>
                                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Performans
                                    </th>
                                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Durum
                                    </th>
                                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Uzmanlık
                                    </th>
                                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                        İşlemler
                                    </th>
                                </tr>
                            </thead>
                            <tbody className={`${isDarkMode ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
                                {filteredAndSortedMembers.map((member) => (
                                    <tr key={member.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                                        {/* TABLE ÜYE */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 relative">
                                                    {member.profileImage ? (
                                                        <img className="h-10 w-10 rounded-full" src={member.profileImage} alt="" />
                                                    ) : (
                                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}>
                                                            <span className={`text-xl ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                                {member.fullName.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white ${getOnlineStatusColor(member.onlineStatus)}`}></span>
                                                </div>
                                                <div className="ml-4">
                                                    <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                        {member.fullName}
                                                    </div>
                                                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        {member.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        {/* TABLE DEPARTMAN */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{member.department}</div>
                                        </td>
                                        {/* TABLE PERFORMANCE */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-1 h-2 bg-gray-200 rounded-full">
                                                    <div
                                                        className="h-2 bg-blue-500 rounded-full"
                                                        style={{ width: `${Math.round(member.performanceScore)}%` }}
                                                    ></div>
                                                </div>
                                                <span className={`ml-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {Math.round(member.performanceScore)}%
                                                </span>
                                            </div>
                                        </td>
                                        {/* TABLE DURUM */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(member.status)}`}>
                                                {member.status}
                                            </span>
                                        </td>
                                        {/* TABLE UZMANLIK */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-wrap gap-1">
                                                {member.expertise === null || member.expertise.length === 0 ? (
                                                    <span 
                                                    className={`group px-2 inline-flex text-xs leading-5 font-semibold rounded-full transition-all duration-200 ease-in-out cursor-pointer 
                                                        ${isDarkMode 
                                                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                                                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                                                          onClick={() => handleAddExpertiseClick(member.id)}>
                                                            Uzmanlık Yok 
                                                            <IoIosAddCircleOutline
                                                                className="w-5 h-5 ml-1 transition-transform duration-200 ease-in-out group-hover:scale-110"
                                                                
                                                            />
                                                        </span>
                                                ) : (
                                                    member.expertise.map((expertise, index) => (
                                                        <span key={index} className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                                                            {expertise}
                                                        </span>
                                                    ))
                                                )}
                                                    
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {teamMembers.some(member => member.role === 'Owner' && member.id === currentUser?.id) && (
                                                <>
                                                    <button
                                                        onClick={() => handleCommentClick(member.id)}
                                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                                                    >
                                                        <ChatBubbleLeftIcon className="h-5 w-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenTaskForm(member, teamId, teamName)}
                                                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 mr-4"
                                                    >
                                                        <ClipboardDocumentListIcon className="h-5 w-5" />
                                                    </button>
                                                    {isTeamOwner && member.id !== currentUser?.id && member.role !== 'Owner' && (
                                                        <button
                                                            onClick={() => handleRemoveMemberClick(teamId, member.id)}
                                                            className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900"
                                                            title="Üyeyi Çıkart"
                                                        >
                                                            <UserMinusIcon className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'available':
                return 'bg-green-100 text-green-800';
            case 'busy':
                return 'bg-red-100 text-red-800';
            case 'away':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getOnlineStatusColor = (status: 'online' | 'offline') => {
        return status === 'online' ? 'bg-green-500' : 'bg-gray-400';
    };

    return (
        <div className="p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Takım Üyeleri</h1>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Üye ara..."
                            className={`pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode
                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                            value={searchQuery}
                            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
                        />
                        <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>

                    <select
                        className={`px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                            }`}
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                    >
                        <option value="all">Tüm Departmanlar</option>
                        {DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>
                                {dept}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={() => setShowCreateTeamModal(true)}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Yeni Ekip
                    </button>
                </div>
            </div>

            {teams.map((team) => (
                <div key={team.id}>
                    {renderTeamMembers(team.members, team.name, team.id)}
                </div>
            ))}

            {/* Create Team Modal */}
            {showCreateTeamModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md ${isDarkMode ? 'dark' : ''}`}>
                        <h2 className="text-2xl font-bold mb-4 dark:text-white">Yeni Ekip Oluştur</h2>
                        <div className="mb-4">
                            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Ekip Adı
                            </label>
                            <input
                                type="text"
                                id="teamName"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="Ekip adını girin"
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="teamDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Ekip Açıklaması
                            </label>
                            <textarea
                                id="teamDescription"
                                value={teamDescription}
                                onChange={(e) => setTeamDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="Ekip açıklamasını girin (opsiyonel)"
                                rows={3}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="teamDepartment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Departman
                            </label>
                            <select
                                id="teamDepartment"
                                value={teamDepartment}
                                onChange={(e) => setTeamDepartment(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value="">Departman Seçin</option>
                                {DEPARTMENTS.map((dept) => (
                                    <option key={dept} value={dept}>
                                        {dept}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                                onClick={() => {
                                    setShowCreateTeamModal(false);
                                    setTeamName('');
                                    setTeamDescription('');
                                    setTeamDepartment('');
                                }}
                            >
                                İptal
                            </button>
                            <button
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                onClick={handleCreateTeam}
                            >
                                Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Uzmanlık Ekleme Modalı */}
            {showExpertiesModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} max-w-md w-full mx-4`}>
                        <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            Uzmanlık Ekle
                        </h3>
                        <div className="mb-4">
                            <label 
                                htmlFor="expertise" 
                                className={`block text-sm font-medium mb-2 ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}
                            >
                                Uzmanlık Alanı
                            </label>
                            <input
                                type="text"
                                id="expertise"
                                value={newExpertise}
                                onChange={(e) => setNewExpertise(e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    isDarkMode 
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                                placeholder="Örn: React, Node.js, MongoDB"
                            />
                        </div>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => {
                                    setShowExpertiesModal(false);
                                    setNewExpertise('');
                                }}
                                className={`px-4 py-2 rounded-lg ${
                                    isDarkMode 
                                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                }`}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleAddExpertise}
                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Davet Linki Modal */}
            {showInviteLinkModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className={`rounded-lg p-6 w-full max-w-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                        <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            Takım Davet Linki
                        </h2>
                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="text"
                                readOnly
                                value={inviteLink}
                                className={`w-full px-4 py-2 border rounded-lg ${isDarkMode
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-gray-50 border-gray-300 text-gray-900'
                                    }`}
                            />
                            <button
                                onClick={handleCopyInviteLink}
                                className={`px-4 py-2 rounded-lg ${copySuccess
                                    ? 'bg-green-500 text-white'
                                    : isDarkMode
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-blue-500 text-white hover:bg-blue-600'
                                    }`}
                            >
                                {copySuccess ? 'Kopyalandı!' : 'Kopyala'}
                            </button>
                        </div>
                        {inviteLink && (
                            <div className="mt-2">
                                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Davet Linki:</h3>
                                <a href={inviteLink} target="_blank" rel="noopener noreferrer" className={`text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300`}>
                                    {inviteLink}
                                </a>
                            </div>
                        )}
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowInviteLinkModal(false)}
                                className={`px-4 py-2 ${isDarkMode
                                    ? 'text-gray-400 hover:text-gray-200'
                                    : 'text-gray-600 hover:text-gray-800'
                                    }`}
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Silme Onay Modalı */}
            {showDeleteConfirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} max-w-md w-full mx-4`}>
                        <h3 className="text-xl font-semibold mb-4">Ekibi Sil</h3>
                        <p className="mb-6">Bu ekibi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => setShowDeleteConfirmModal(false)}
                                className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleDeleteTeam}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                            >
                                Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Üye Çıkartma Onay Modalı */}
            {showRemoveMemberModal && memberToRemove && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} max-w-md w-full mx-4`}>
                        <h3 className="text-xl font-semibold mb-4">Üyeyi Çıkart</h3>
                        <p className="mb-6">Bu üyeyi ekipten çıkartmak istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => setShowRemoveMemberModal(false)}
                                className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleRemoveMember}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                            >
                                Çıkart
                            </button>
                        </div>
                    </div>
                </div>
            )}
        <Footer />
            {showCommentModal && (
                <UserTaskCommentModal
                    isOpen={showCommentModal}
                    onClose={() => {
                        setShowCommentModal(false);
                        setSelectedUserId('');
                    }}
                    userId={selectedUserId}
                />
            )}

            {showTaskForm && selectedMemberForTask && (
                <TaskForm
                    isOpen={showTaskForm}
                    onClose={() => setShowTaskForm(false)}
                    onSave={handleCreateTask}
                    selectedUser={selectedMemberForTask}
                    teamId={selectedTeamForTask?.id}
                    teamName={selectedTeamForTask?.name}
                    isDarkMode={isDarkMode}
                />
            )}
        </div>
        
    );
};

export default Team;