import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { setError } from '../../redux/features/calendarSlice';
import type { CalendarEvent } from '../../redux/features/calendarSlice';
import { teamService } from '../../services';
import type { TeamMember } from '../../types/team';

type EventFormData = Omit<CalendarEvent, 'id'>;

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (eventData: EventFormData) => void;
  initialData?: CalendarEvent;
}

/**
 * Modal component for creating and editing calendar events
 * @param isOpen - Whether the modal is visible
 * @param onClose - Function to call when closing the modal
 * @param onSubmit - Function to call with form data when submitting
 * @param initialData - Optional event data for editing mode
 */
const CreateEventModal = ({ isOpen, onClose, onSubmit, initialData }: CreateEventModalProps) => {
  const { isDarkMode } = useTheme();
  const dispatch = useDispatch();

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    participants: [],
    category: initialData?.category || 'task',
  });

  useEffect(() => {
    const loadTeamMembers = async () => {
      try {
        const teams = await teamService.getMyTeams();
        if (teams.length > 0) {
          const members = await teamService.getTeamMembers(teams[0].id);
          setTeamMembers(members);
        }
      } catch (error) {
        console.error('Error loading team members:', error);
        dispatch(setError('Failed to load team members'));
      }
    };

    loadTeamMembers();
  }, [dispatch]);

  useEffect(() => {
    if (initialData) {
      const {  ...rest } = initialData;
      setFormData(rest);
    } else {
      setFormData({
        title: '',
        description: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        priority: 'Medium',
        participants: [],
        category: 'task',
      });
    }
  }, [initialData]);

  const filteredMembers = teamMembers.filter(member =>
    (member.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (member.fullName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleAddParticipant = (email: string) => {
    if (!formData.participants.includes(email)) {
      setFormData({
        ...formData,
        participants: [...formData.participants, email]
      });
    }
    setSearchTerm('');
    setIsDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    if (!formData.title.trim()) {
      dispatch(setError('Event title is required'));
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      dispatch(setError('Event dates are required'));
      return;
    }

    // Check if end date is before start date
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      dispatch(setError('End date must be after start date'));
      return;
    }

    // Check if times are valid when on same day
    if (formData.startDate === formData.endDate && 
        new Date(formData.startDate + 'T' + formData.startTime) >= new Date(formData.endDate + 'T' + formData.endTime)) {
      dispatch(setError('End time must be after start time on the same day'));
      return;
    }

    onSubmit(formData);
    
    if (!initialData) {
      setFormData({
        title: '',
        description: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        priority: 'Medium',
        participants: [],
        category: 'task',
      });
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="relative z-50"
        onClose={onClose}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel 
                className={`w-full max-w-md transform overflow-hidden rounded-2xl p-6 text-left align-middle shadow-xl transition-all
                  ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
              >
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 mb-4"
                >
                  {initialData ? 'Edit Event' : 'Create New Event'}
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className={`w-full rounded-lg border p-2 
                        ${isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className={`w-full rounded-lg border p-2 
                        ${isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => {
                          const newStartDate = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            startDate: newStartDate,
                            // Update end date if it's before new start date
                            endDate: new Date(prev.endDate) < new Date(newStartDate) ? newStartDate : prev.endDate
                          }));
                        }}
                        className={`w-full rounded-lg border p-2 
                          ${isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        min={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className={`w-full rounded-lg border p-2 
                          ${isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className={`w-full rounded-lg border p-2 
                          ${isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className={`w-full rounded-lg border p-2 
                          ${isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Participants
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.participants.map((participant, index) => (
                        <div 
                          key={index}
                          className={`flex items-center px-3 py-1 rounded-full text-sm
                            ${isDarkMode 
                              ? 'bg-gray-700 text-white' 
                              : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          <span>{participant}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newParticipants = [...formData.participants];
                              newParticipants.splice(index, 1);
                              setFormData({ ...formData, participants: newParticipants });
                            }}
                            className="ml-2 text-gray-500 hover:text-gray-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search team members..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        className={`w-full rounded-lg border p-2 
                          ${isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                          }`}
                      />
                      {isDropdownOpen && searchTerm && (
                        <div 
                          className={`absolute z-10 w-full mt-1 rounded-md shadow-lg
                            ${isDarkMode ? 'bg-gray-700' : 'bg-white'} border
                            ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                        >
                          {filteredMembers.length > 0 ? (
                            <ul className="max-h-60 overflow-auto py-1">
                              {filteredMembers.map((member) => (
                                <li
                                  key={member.id}
                                  className={`px-4 py-2 cursor-pointer hover:bg-gray-100
                                    ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}`}
                                  onClick={() => handleAddParticipant(member.email)}
                                >
                                  <div className="flex items-center">
                                    <div>
                                      <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        {member.fullName}
                                      </div>
                                      <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                        {member.email}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="px-4 py-2 text-sm text-gray-500">
                              No team members found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Priority
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'High' | 'Medium' | 'Low' })}
                      className={`mt-1 block w-full rounded-md border p-2 
                        ${isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'}`}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Category
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as 'meeting' | 'task' | 'deadline' })}
                      className={`mt-1 block w-full rounded-md border p-2 
                        ${isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'}`}
                    >
                      <option value="task">Task</option>
                      <option value="meeting">Meeting</option>
                      <option value="deadline">Deadline</option>
                    </select>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className={`px-4 py-2 rounded-lg border
                        ${isDarkMode
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      {initialData ? 'Save Changes' : 'Create Event'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreateEventModal;