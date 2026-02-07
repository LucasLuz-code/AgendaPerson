/**
 * TASKFLOW PRO - COLORFUL SCRIPT
 * Mesma lógica, design vibrante e interativo
 */

// --- CONFIGURAÇÃO SUPABASE ---
const SUPABASE_URL = 'https://jjqymzurlqurxsmccofb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8_ph7PbHo8pT_aRMtrG9FQ_l1ltdm3E';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL ---
let state = {
    tasks: [],
    filter: 'Todos',
    search: '',
    isDarkMode: false,
    taskToComplete: null,
    previousStatus: null
};

// --- ELEMENTOS DO DOM ---
const dom = {
    tasksPending: document.getElementById('tasks-pending'),
    tasksCompleted: document.getElementById('tasks-completed'),
    badgePending: document.getElementById('badge-pending'),
    badgeCompleted: document.getElementById('badge-completed'),
    taskModal: document.getElementById('task-modal'),
    completeModal: document.getElementById('complete-modal'),
    detailsModal: document.getElementById('details-modal'),
    formTask: document.getElementById('form-task'),
    tccArea: document.getElementById('tcc-area'),
    searchInput: document.getElementById('search-tasks'),
    themeBtn: document.getElementById('theme-btn'),
    loader: document.getElementById('loader'),
    categoryItems: document.querySelectorAll('.category-item'),
    completedByInput: document.getElementById('inp-completed-by'),
    btnConfirmDone: document.getElementById('btn-confirm-done'),
    streakCount: document.getElementById('streak-count'),
    completedCount: document.getElementById('completed-count')
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando TaskFlow Pro...');
    
    initTheme();
    await fetchTasks();
    initSortable();
    
    setTimeout(() => dom.loader.style.opacity = '0', 500);
    setTimeout(() => dom.loader.style.display = 'none', 1000);
});

// --- FUNÇÕES DE DADOS (SUPABASE) ---

async function fetchTasks() {
    try {
        const { data, error } = await supabaseClient
            .from('tarefas')
            .select('*')
            .order('date', { ascending: true, nullsFirst: false });

        if (error) throw error;
        state.tasks = data || [];
        updateStats();
        render();
    } catch (err) {
        showError('Erro ao carregar tarefas', err);
    }
}

async function handleSaveTask(e) {
    e.preventDefault();
    
    const id = document.getElementById('edit-id').value;
    const status = document.getElementById('inp-status').value;
    
    const taskData = {
        description: document.getElementById('inp-description').value,
        date: document.getElementById('inp-date').value || null,
        priority: document.getElementById('inp-priority').value,
        category: document.getElementById('inp-category').value,
        details: document.getElementById('inp-details').value,
        status: status,
        completed: status === 'pronto',
        completed_by: status === 'pronto' ? (document.getElementById('inp-completed-by')?.value || null) : null
    };

    if (status === 'pronto' && !id) {
        state.pendingTaskData = taskData;
        closeModals();
        openCompleteModal(null, taskData);
        return;
    }

    try {
        let response;
        if (id) {
            response = await supabaseClient
                .from('tarefas')
                .update(taskData)
                .eq('id', id);
        } else {
            response = await supabaseClient
                .from('tarefas')
                .insert([taskData]);
        }

        if (response.error) throw response.error;
        
        closeModals();
        await fetchTasks();
    } catch (err) {
        showError('Erro ao salvar tarefa', err);
    }
}

async function deleteTask(id) {
    if (!confirm('Deseja realmente excluir esta tarefa?')) return;

    try {
        const { error } = await supabaseClient
            .from('tarefas')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchTasks();
    } catch (err) {
        showError('Erro ao excluir', err);
    }
}

async function changeStatus(id, newStatus) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    if (newStatus === 'pronto') {
        state.previousStatus = task.status || 'ninguem-fazendo';
        openCompleteModal(id);
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('tarefas')
            .update({ 
                status: newStatus,
                completed: false,
                completed_by: null
            })
            .eq('id', id);

        if (error) throw error;
        await fetchTasks();
    } catch (err) {
        showError('Erro ao atualizar status', err);
    }
}

function openCompleteModal(taskId, pendingData = null) {
    state.taskToComplete = taskId;
    state.pendingTaskData = pendingData;
    dom.completedByInput.value = '';
    dom.completeModal.classList.add('active');
    dom.completedByInput.focus();
}

async function cancelComplete() {
    if (state.taskToComplete && state.previousStatus) {
        try {
            const { error } = await supabaseClient
                .from('tarefas')
                .update({ status: state.previousStatus })
                .eq('id', state.taskToComplete);

            if (error) throw error;
            await fetchTasks();
        } catch (err) {
            showError('Erro ao reverter status', err);
        }
    }

    dom.completeModal.classList.remove('active');
    state.taskToComplete = null;
    state.previousStatus = null;
    state.pendingTaskData = null;
}

async function confirmComplete() {
    const completedBy = dom.completedByInput.value.trim();
    
    if (!completedBy) {
        alert('Por favor, digite quem completou a tarefa.');
        dom.completedByInput.focus();
        return;
    }

    try {
        if (state.taskToComplete) {
            const { error } = await supabaseClient
                .from('tarefas')
                .update({ 
                    status: 'pronto',
                    completed: true,
                    completed_by: completedBy,
                    completed_at: new Date().toISOString()
                })
                .eq('id', state.taskToComplete);

            if (error) throw error;
        } else if (state.pendingTaskData) {
            const taskData = {
                ...state.pendingTaskData,
                completed: true,
                completed_by: completedBy,
                completed_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('tarefas')
                .insert([taskData]);

            if (error) throw error;
        }

        dom.completeModal.classList.remove('active');
        state.taskToComplete = null;
        state.previousStatus = null;
        state.pendingTaskData = null;
        await fetchTasks();
    } catch (err) {
        showError('Erro ao confirmar conclusão', err);
    }
}

// --- RENDERIZAÇÃO E UI ---

function render() {
    let filtered = state.tasks.filter(t => {
        const matchesFilter = state.filter === 'Todos' || t.category === state.filter;
        const matchesSearch = t.description.toLowerCase().includes(state.search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    filtered = filtered.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date('9999-12-31');
        const dateB = b.date ? new Date(b.date) : new Date('9999-12-31');
        return dateA - dateB;
    });

    const pending = filtered.filter(t => !t.completed);
    const completed = filtered.filter(t => t.completed);

    dom.tasksPending.innerHTML = pending.map(t => createTaskCard(t)).join('');
    dom.tasksCompleted.innerHTML = completed.map(t => createTaskCard(t)).join('');

    dom.badgePending.textContent = pending.length;
    dom.badgeCompleted.textContent = completed.length;
}

function createTaskCard(task) {
    const dateFormatted = task.date ? new Date(task.date).toLocaleDateString('pt-BR') : 'Sem prazo';
    const isTCC = task.category === 'TCC';
    
    const statusConfig = {
        'ninguem-fazendo': { label: '⚪ Ninguém Fazendo', class: 'ninguem-fazendo' },
        'desenvolvendo': { label: '🔵 Desenvolvendo', class: 'desenvolvendo' },
        'quase-pronto': { label: '🟡 Quase Pronto', class: 'quase-pronto' },
        'pronto': { label: '🟢 Pronto', class: 'pronto' }
    };

    const currentStatus = task.status || 'ninguem-fazendo';
    const statusInfo = statusConfig[currentStatus];

    return `
        <div class="task-card-colorful prio-${task.priority} ${task.completed ? 'completed' : ''} animate__animated animate__fadeIn" data-id="${task.id}">
            <div class="task-header">
                <div class="task-info">
                    <h3>${task.description}</h3>
                    <div class="task-badges">
                        <span class="badge-item badge-date">
                            <i class="far fa-calendar"></i> ${dateFormatted}
                        </span>
                        <span class="badge-item badge-category">
                            ${getCategoryIcon(task.category)} ${task.category}
                        </span>
                    </div>
                    ${!task.completed ? `
                        <div class="status-selector">
                            <select onchange="changeStatus('${task.id}', this.value)" class="status-btn status-${currentStatus}">
                                <option value="ninguem-fazendo" ${currentStatus === 'ninguem-fazendo' ? 'selected' : ''}>⚪ Ninguém Fazendo</option>
                                <option value="desenvolvendo" ${currentStatus === 'desenvolvendo' ? 'selected' : ''}>🔵 Desenvolvendo</option>
                                <option value="quase-pronto" ${currentStatus === 'quase-pronto' ? 'selected' : ''}>🟡 Quase Pronto</option>
                                <option value="pronto" ${currentStatus === 'pronto' ? 'selected' : ''}>🟢 Pronto</option>
                            </select>
                        </div>
                    ` : ''}
                    ${task.completed && task.completed_by ? `
                        <div class="completion-badge">
                            <i class="fas fa-user-check"></i>
                            <strong>Feito por ${task.completed_by}</strong>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="task-actions">
                ${isTCC && task.details ? `
                    <button class="action-btn" onclick="showDetails('${task.id}')" title="Ver Detalhes">
                        <i class="fas fa-eye"></i> Detalhes
                    </button>
                ` : ''}
                <button class="action-btn" onclick="editTask('${task.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="action-btn danger" onclick="deleteTask('${task.id}')">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        </div>
    `;
}

function getCategoryIcon(category) {
    const icons = {
        'Tarefas': '📋',
        'Provas': '📝',
        'Trabalhos': '📂',
        'TCC': '🎓'
    };
    return icons[category] || '📌';
}

function updateStats() {
    const completed = state.tasks.filter(t => t.completed).length;
    dom.completedCount.textContent = completed;
    dom.streakCount.textContent = Math.min(completed, 99);
}

// --- EVENTOS DE INTERFACE ---

document.getElementById('btn-add-task').addEventListener('click', () => {
    dom.formTask.reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('modal-header').textContent = '✨ Nova Tarefa';
    document.getElementById('inp-status').value = 'ninguem-fazendo';
    dom.tccArea.classList.add('hidden');
    dom.taskModal.classList.add('active');
});

document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
});

document.querySelectorAll('.modal-close-complete').forEach(btn => {
    btn.addEventListener('click', cancelComplete);
});

function closeModals() {
    dom.taskModal.classList.remove('active');
    dom.detailsModal.classList.remove('active');
    dom.completeModal.classList.remove('active');
}

dom.btnConfirmDone.addEventListener('click', confirmComplete);

dom.completeModal.addEventListener('click', (e) => {
    if (e.target === dom.completeModal) {
        cancelComplete();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.completeModal.classList.contains('active')) {
        cancelComplete();
    }
});

dom.completedByInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        confirmComplete();
    }
});

document.getElementById('inp-category').addEventListener('change', (e) => {
    if (e.target.value === 'TCC') {
        dom.tccArea.classList.remove('hidden');
        document.getElementById('inp-details').required = true;
    } else {
        dom.tccArea.classList.add('hidden');
        document.getElementById('inp-details').required = false;
    }
});

dom.formTask.addEventListener('submit', handleSaveTask);

window.editTask = (id) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('edit-id').value = task.id;
    document.getElementById('inp-description').value = task.description;
    document.getElementById('inp-date').value = task.date || '';
    document.getElementById('inp-priority').value = task.priority;
    document.getElementById('inp-category').value = task.category;
    document.getElementById('inp-details').value = task.details || '';
    document.getElementById('inp-status').value = task.status || 'ninguem-fazendo';

    document.getElementById('modal-header').textContent = '✏️ Editar Tarefa';
    if (task.category === 'TCC') dom.tccArea.classList.remove('hidden');
    
    dom.taskModal.classList.add('active');
};

window.showDetails = (id) => {
    const task = state.tasks.find(t => t.id === id);
    const content = document.getElementById('details-body');
    
    const statusLabels = {
        'ninguem-fazendo': '⚪ Ninguém Fazendo',
        'desenvolvendo': '🔵 Desenvolvendo',
        'quase-pronto': '🟡 Quase Pronto',
        'pronto': '🟢 Pronto'
    };
    
    content.innerHTML = `
        <div class="form-field">
            <label>📝 Descrição</label>
            <p style="font-weight: 700; font-size: 1.1rem;">${task.description}</p>
        </div>
        <div class="form-row">
            <div class="form-field">
                <label>📅 Data</label>
                <p>${task.date ? new Date(task.date).toLocaleDateString('pt-BR') : 'Não definida'}</p>
            </div>
            <div class="form-field">
                <label>🚩 Prioridade</label>
                <p style="font-weight: 800; text-transform: uppercase;">${task.priority}</p>
            </div>
        </div>
        <div class="form-field">
            <label>📊 Status</label>
            <p style="font-weight: 700;">${statusLabels[task.status || 'ninguem-fazendo']}</p>
        </div>
        ${task.completed_by ? `
            <div class="form-field">
                <label>✅ Concluído por</label>
                <p style="font-weight: 700; color: var(--color-green);">${task.completed_by}</p>
            </div>
        ` : ''}
        <div class="form-field">
            <label>📋 Etapas e Observações</label>
            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 10px; white-space: pre-wrap; line-height: 1.6;">${task.details}</div>
        </div>
    `;
    dom.detailsModal.classList.add('active');
};

window.changeStatus = changeStatus;

dom.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
});

dom.categoryItems.forEach(item => {
    item.addEventListener('click', () => {
        dom.categoryItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        state.filter = item.dataset.filter;
        render();
    });
});

// --- UTILITÁRIOS ---

function initSortable() {
    new Sortable(dom.tasksPending, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        handle: '.task-card-colorful'
    });
}

function initTheme() {
    const saved = localStorage.getItem('taskflow-theme');
    if (saved === 'dark') {
        document.body.classList.replace('theme-light', 'theme-dark');
        state.isDarkMode = true;
        updateThemeUI();
    }
}

dom.themeBtn.addEventListener('click', () => {
    state.isDarkMode = !state.isDarkMode;
    document.body.classList.toggle('theme-dark');
    document.body.classList.toggle('theme-light');
    localStorage.setItem('taskflow-theme', state.isDarkMode ? 'dark' : 'light');
    updateThemeUI();
});

function updateThemeUI() {
    const icon = dom.themeBtn.querySelector('i');
    const text = dom.themeBtn.querySelector('span');
    icon.className = state.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    text.textContent = state.isDarkMode ? 'Modo Claro' : 'Modo Noturno';
}

function showError(title, err) {
    console.error(`❌ ${title}:`, err);
    alert(`${title}\n\nVerifique o console para detalhes técnicos.`);
}
