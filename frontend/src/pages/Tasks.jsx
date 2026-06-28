import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import  useAuthStore  from '../store/auth';
import CreateTaskForm from '../components/CreateTaskForm';
import { PageHeader, Card, Btn, Badge, EmptyState, Spinner } from '../components/ui';

const PLATFORM_ICON = { LinkedIn: '💼', Instagram: '📸', Twitter: '🐦', Facebook: '👍', YouTube: '📺' };

export default function Tasks() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [selectedTask, setSelectedTask] = useState(null);
    const [showForm, setFormShow] = useState(false);

    const handleEdit = (task) => {
        setSelectedTask(task);
        setFormShow(true);
    };

    const handleDelete = (id) => {
        if (window.confirm("Are you sure you want to permanently delete this task?")) {
            deleteMutation.mutate(id, {
                onSuccess: () => {
                    alert("Task removed successfully!");
                },
                onError: (err) => {
                    console.error("Delete Failed:", err);
                    alert("Failed to delete the task.");
                }
            });
        }
    };

    const canVerify = ['CAPTAIN', 'TL', 'SENIOR_TL'].includes(user?.role);
    const canCreateTask = ['ADMIN', 'SENIOR_TL'].includes(user?.role);

    const { data: tasks, isLoading } = useQuery({
        queryKey: ['tasks'],
        queryFn: () => api.get('/tasks').then(res => res.data),
    });

    const { data: proofs, refetch: refetchProofs } = useQuery({
        queryKey: ['proofs', selectedTask],
        queryFn: () => api.get(`/proofs/task/${selectedTask}`).then(res => res.data),
        enabled: !!selectedTask,
    });

    const deleteMutation = useMutation({
        mutationFn: (taskId) => api.delete(`/tasks/${taskId}`).then(res => res.data),
        onSuccess: () => {
            queryClient.invalidateQueries(['tasks']);
        }
    });

    const submitMutation = useMutation({
        mutationFn: ({ taskId, file }) => {
            const form = new FormData();
            form.append('task_id', taskId);
            form.append('image', file);
            return api.post('/proofs/submit', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        },
        onSuccess: () => { refetchProofs(); queryClient.invalidateQueries(['proofs']); },
    });

    const verifyMutation = useMutation({
        mutationFn: (proofId) => api.patch(`/proofs/${proofId}/verify`),
        onSuccess: () => refetchProofs()
    });

    const handleUpload = (e, taskId) => {
        const file = e.target.files[0];
        if (file) submitMutation.mutate({ taskId, file });
    };

    const overdue = (d) => new Date(d) < new Date();

    return (
        <div>
            <PageHeader
                title="Social Media Tasks"
                icon="📱"
                subtitle="Campaigns & proof verification"
                actions={canCreateTask && (
                    <Btn onClick={() => setFormShow(s => !s)}>
                        {showForm ? '✕ Cancel' : '+ Create task'}
                    </Btn>
                )}
            />

            {showForm && canCreateTask && (
                <div className="mb-5 animate-fade-in-up">
                    <CreateTaskForm 
                        task={selectedTask} 
                        onClose={() => {
                            setFormShow(false);
                            setSelectedTask(null);
                        }} 
                    />
                </div>
            )}

            {isLoading ? (
                <Spinner />
            ) : !tasks?.length ? (
                <EmptyState title="No tasks yet" text={canCreateTask ? "Create a campaign to get started." : "New tasks will appear here."} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {tasks.map(t => (
                        <Card key={t.id} className="p-5 card-hover flex flex-col justify-between">
                            <div>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{PLATFORM_ICON[t.target_platform || t.targetPlatform] || '🔗'}</span>
                                        <h3 className="font-semibold text-gray-800">{t.title}</h3>
                                    </div>
                                    <Badge color={overdue(t.deadline) ? 'red' : 'blue'}>
                                        {overdue(t.deadline) ? 'Overdue' : 'Active'}
                                    </Badge>
                                </div>
                                <p className="text-gray-600 text-sm mt-2">{t.description}</p>
                                {t.task_link && (
                                    <a href={t.task_link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-2 inline-block truncate max-w-full">
                                        {t.task_link}
                                    </a>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center gap-3 mt-4">
                                    {canVerify && (
                                        <Btn 
                                            variant="outline" 
                                            onClick={() => setSelectedTask(selectedTask === t.id ? null : t.id)}
                                        >
                                            {selectedTask === t.id ? 'Hide proofs' : 'View proofs'}
                                        </Btn>
                                    )}

                                    {['ADMIN', 'SENIOR_TL'].includes(user?.role) && (
                                        <div className="flex gap-2">
                                            <Btn variant="outline" onClick={() => handleEdit(t)}>
                                                Edit
                                            </Btn>
                                            <Btn
                                                variant="destructive"
                                                onClick={() => handleDelete(t.id)}
                                                isLoading={deleteMutation.isPending && deleteMutation.variables === t.id}
                                            >
                                                Delete
                                            </Btn>
                                        </div>
                                    )}

                                    {user?.role === 'INTERN' && (
                                        <label className="px-4 py-2 text-sm font-semibold text-white transition rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-lg cursor-pointer">
                                            Upload proof
                                            <input type="file" accept="image/*" onChange={(e) => handleUpload(e, t.id)} className="hidden" />
                                        </label>
                                    )}
                                </div>

                                {selectedTask === t.id && (
                                    <div className="mt-4 border-t pt-4 space-y-2 animate-fade-in">
                                        <h4 className="text-sm font-semibold text-gray-700">Proof submissions</h4>
                                        {!proofs?.length ? (
                                            <p className="text-xs text-gray-400">No submissions yet.</p>
                                        ) : (
                                            proofs.map(p => (
                                                <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2">
                                                    {p.image_path && (
                                                        <img 
                                                            src={'/' + p.image_path.replace(/^\//, '')} 
                                                            alt="proof" 
                                                            className="w-14 h-14 rounded-lg object-cover border" 
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0 text-xs">
                                                        <Badge color={p.status === 'VERIFIED' ? 'green' : 'yellow'}>
                                                            {p.status}
                                                        </Badge>
                                                        <p className="text-gray-400 mt-1 truncate">
                                                            Intern: {p.intern_id.slice(0, 8)}...
                                                        </p>
                                                    </div>
                                                    {canVerify && p.status === 'PENDING' && (
                                                        <Btn variant="success" onClick={() => verifyMutation.mutate(p.id)}>
                                                            ✓ Verify
                                                        </Btn>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}